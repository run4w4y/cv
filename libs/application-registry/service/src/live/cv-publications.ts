import { ArtifactStore } from '@cv/application-registry-artifact-store'
import {
  ApplicationsCrud,
  ContentCrud,
  CvLinksCrud,
} from '@cv/application-registry-crud'
import type {
  ApplicationStatus,
  ContentEntry,
  CvLink,
} from '@cv/application-registry-entity'
import { Effect, Layer } from 'effect'

import {
  RegistryBadRequestError,
  RegistryConflictError,
  RegistryNotFoundError,
} from '../errors'
import {
  findApplicationForContent,
  readOpaquePayload,
  requireAssociatedEntry,
  requireAssociatedRevision,
  requireNonEmpty,
} from '../internal/opaque-content'
import {
  missingRegistryData,
  newRegistryId,
  registryNow,
} from '../internal/shared'
import {
  applicationRejectedDisableReason,
  CvPublicationsService,
  type CvPublicationsService as CvPublicationsServiceShape,
} from '../services/cv-publications'
import type { PublishCvInput, SetCvLinkAvailabilityInput } from '../types'

const requireCvEntry = (entry: ContentEntry) =>
  entry.kind === 'cv'
    ? Effect.succeed(entry)
    : Effect.fail(
        new RegistryBadRequestError({
          message: 'Only CV content entries can have a public CV link.',
        })
      )

const publicUrl = (
  baseUrl: string,
  token: string
): Effect.Effect<string, RegistryBadRequestError> =>
  Effect.try({
    try: () => {
      const base = new URL(baseUrl)
      if (base.protocol !== 'https:' && base.protocol !== 'http:') {
        throw new Error('Public CV base URL must use HTTP or HTTPS.')
      }
      base.hash = ''
      base.search = ''
      base.pathname = `${base.pathname.replace(/\/?$/u, '/')}${encodeURIComponent(token)}`
      return `${base.origin}${base.pathname}`
    },
    catch: () =>
      new RegistryBadRequestError({
        message: `Invalid public CV base URL: ${baseUrl}`,
      }),
  })

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const content = yield* ContentCrud
  const links = yield* CvLinksCrud
  const store = yield* ArtifactStore

  const reconcileLinkForApplicationStatus = Effect.fn(
    'CvPublicationsService.reconcileLinkForApplicationStatus'
  )((applicationStatus: ApplicationStatus, link: CvLink) =>
    Effect.gen(function* () {
      const rejectedWithVisibleLink =
        applicationStatus === 'rejected' && link.enabled

      if (!rejectedWithVisibleLink) return link

      const now = yield* registryNow
      const repaired = yield* links
        .disableForApplication(
          link.applicationId,
          applicationRejectedDisableReason,
          now
        )
        .pipe(
          Effect.as(true),
          Effect.catch((error) =>
            Effect.logWarning(error.message).pipe(Effect.as(false))
          )
        )

      if (repaired) {
        const stored = yield* links
          .findByEntry(link.contentEntryId)
          .pipe(
            Effect.catch((error) =>
              Effect.logWarning(error.message).pipe(Effect.as(undefined))
            )
          )
        if (stored && !stored.enabled) return stored
      }

      // A rejected application must fail closed even if the best-effort repair
      // cannot be persisted.
      return {
        ...link,
        disabledAt: now,
        disabledReason: applicationRejectedDisableReason,
        enabled: false,
      }
    })
  )

  const findAssociatedLink = Effect.fn('CvPublicationsService.findByEntry')(
    (applicationIdentifier: string, entryId: string) =>
      Effect.gen(function* () {
        const application = yield* findApplicationForContent(
          applications,
          applicationIdentifier
        )
        const entry = yield* requireAssociatedEntry(
          content,
          application.id,
          entryId
        )
        yield* requireCvEntry(entry)
        const link = yield* links.findByEntry(entry.id)
        if (!link || link.applicationId !== application.id) {
          return yield* new RegistryNotFoundError({
            identifier: entry.id,
            message: `Public CV link not found for content entry ${entry.id}.`,
          })
        }
        return yield* reconcileLinkForApplicationStatus(
          application.applicationStatus,
          link
        )
      })
  )

  const requirePublishableRevision = (
    entry: ContentEntry,
    revisionId: string | null
  ) =>
    revisionId
      ? requireAssociatedRevision(content, entry.id, revisionId)
      : Effect.fail(
          new RegistryConflictError({
            message:
              'The CV content must have an approved revision before publication.',
          })
        )

  return {
    disableForApplication: Effect.fn(
      'CvPublicationsService.disableForApplication'
    )((applicationIdentifier: string, reason: string) =>
      Effect.gen(function* () {
        const application = yield* findApplicationForContent(
          applications,
          applicationIdentifier
        )
        const normalizedReason = yield* requireNonEmpty(
          reason,
          'Disable reason'
        )
        return yield* links.disableForApplication(
          application.id,
          normalizedReason,
          yield* registryNow
        )
      })
    ),
    findByEntry: findAssociatedLink,
    restoreAfterRejection: Effect.fn(
      'CvPublicationsService.restoreAfterRejection'
    )((applicationIdentifier: string) =>
      Effect.gen(function* () {
        const application = yield* findApplicationForContent(
          applications,
          applicationIdentifier
        )
        if (application.applicationStatus === 'rejected') return 0
        return yield* links.enableForApplication(
          application.id,
          applicationRejectedDisableReason,
          yield* registryNow
        )
      })
    ),
    publish: Effect.fn('CvPublicationsService.publish')(
      (applicationIdentifier: string, entryId: string, input: PublishCvInput) =>
        Effect.gen(function* () {
          const application = yield* findApplicationForContent(
            applications,
            applicationIdentifier
          )
          if (application.applicationStatus === 'rejected') {
            return yield* new RegistryConflictError({
              message: 'A rejected application cannot publish a CV link.',
            })
          }
          const entry = yield* requireAssociatedEntry(
            content,
            application.id,
            entryId
          )
          yield* requireCvEntry(entry)
          if (input.expectedContentVersion !== entry.version) {
            return yield* new RegistryConflictError({
              message: `Content entry version ${entry.version} does not match expected version ${input.expectedContentVersion}.`,
            })
          }
          const revision = yield* requirePublishableRevision(
            entry,
            entry.approvedRevisionId
          )
          const existing = yield* links.findByEntry(entry.id)
          if (existing && existing.applicationId !== application.id) {
            return yield* new RegistryConflictError({
              message: 'The public CV link belongs to another application.',
            })
          }

          const token = existing?.token ?? newRegistryId().replaceAll('-', '')
          const now = yield* registryNow
          yield* links.publish({
            applicationId: application.id,
            contentEntryId: entry.id,
            createdAt: existing?.createdAt ?? now,
            id: existing?.id ?? newRegistryId(),
            publishedRevisionId: revision.id,
            publicUrl: yield* publicUrl(input.publicBaseUrl, token),
            token,
            updatedAt: now,
          })
          const published = yield* links.findByEntry(entry.id)
          if (!published) {
            return yield* missingRegistryData(
              `Public CV link was not persisted for content entry ${entry.id}.`
            )
          }
          if (
            published.applicationId !== application.id ||
            published.publishedRevisionId !== revision.id ||
            published.token !== token
          ) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link changed while publication was being recorded.',
            })
          }
          return published
        })
    ),
    resolve: Effect.fn('CvPublicationsService.resolve')((token: string) =>
      Effect.gen(function* () {
        const storedLink = yield* links.findByToken(token)
        if (!storedLink) {
          return yield* new RegistryNotFoundError({
            identifier: token,
            message: `Public CV link not found: ${token}`,
          })
        }
        const application = yield* findApplicationForContent(
          applications,
          storedLink.applicationId
        )
        const reconciledLink = yield* reconcileLinkForApplicationStatus(
          application.applicationStatus,
          storedLink
        )
        if (application.applicationStatus === 'rejected') {
          return yield* new RegistryNotFoundError({
            identifier: token,
            message: `Public CV link not found: ${token}`,
          })
        }
        const link = reconciledLink
        if (!link.enabled) {
          return yield* new RegistryNotFoundError({
            identifier: token,
            message: `Public CV link not found: ${token}`,
          })
        }
        const entry = yield* requireAssociatedEntry(
          content,
          link.applicationId,
          link.contentEntryId
        )
        yield* requireCvEntry(entry)
        const revision = yield* requireAssociatedRevision(
          content,
          entry.id,
          link.publishedRevisionId
        )
        const bytes = yield* readOpaquePayload(store, revision.sha256)
        return { bytes, entry, link, revision }
      })
    ),
    setAvailability: Effect.fn('CvPublicationsService.setAvailability')(
      (
        applicationIdentifier: string,
        entryId: string,
        input: SetCvLinkAvailabilityInput
      ) =>
        Effect.gen(function* () {
          const application = yield* findApplicationForContent(
            applications,
            applicationIdentifier
          )
          if (input.enabled && application.applicationStatus === 'rejected') {
            return yield* new RegistryConflictError({
              message:
                'A rejected application CV link cannot be enabled until the application is reopened.',
            })
          }
          const entry = yield* requireAssociatedEntry(
            content,
            application.id,
            entryId
          )
          yield* requireCvEntry(entry)
          const link = yield* findAssociatedLink(application.id, entry.id)
          if (link.publicationVersion !== input.expectedPublicationVersion) {
            return yield* new RegistryConflictError({
              message: `Public CV publication version ${link.publicationVersion} does not match expected version ${input.expectedPublicationVersion}.`,
            })
          }
          if (link.enabled === input.enabled) return link

          if (input.enabled) {
            yield* requireAssociatedRevision(
              content,
              entry.id,
              link.publishedRevisionId
            )
          }
          const reason = input.enabled
            ? null
            : yield* requireNonEmpty(input.reason ?? '', 'Disable reason')
          const updated = yield* links.setEnabled(
            link.id,
            link.version,
            link.publicationVersion,
            input.enabled,
            reason,
            yield* registryNow
          )
          if (!updated) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link changed while its availability was being updated.',
            })
          }
          return yield* links
            .findByEntry(entry.id)
            .pipe(
              Effect.flatMap((stored) =>
                stored
                  ? Effect.succeed(stored)
                  : Effect.fail(
                      missingRegistryData(
                        `Public CV link disappeared: ${link.id}`
                      )
                    )
              )
            )
        })
    ),
  } satisfies CvPublicationsServiceShape
})

export const CvPublicationsServiceLive = Layer.effect(
  CvPublicationsService,
  make
)
