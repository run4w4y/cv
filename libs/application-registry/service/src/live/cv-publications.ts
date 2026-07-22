import { ArtifactStore } from '@cv/application-registry-artifact-store'
import {
  ApplicationsCrud,
  ArtifactsCrud,
  ContentCrud,
  CvLinksCrud,
} from '@cv/application-registry-crud'
import type {
  ApplicationStatus,
  ContentEntry,
  CvLink,
} from '@cv/application-registry-entity'
import {
  RegistryEventPublisher,
  RegistryEventSchema,
} from '@cv/application-registry-events'
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
import type { SetCvLinkAvailabilityInput, StageCvInput } from '../types'

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
  const artifacts = yield* ArtifactsCrud
  const content = yield* ContentCrud
  const links = yield* CvLinksCrud
  const store = yield* ArtifactStore
  const events = yield* RegistryEventPublisher

  const publishAvailabilityChanged = Effect.fn(
    'CvPublicationsService.publishAvailabilityChanged'
  )((link: CvLink, operationId: string) =>
    events.publish(
      RegistryEventSchema.cases.CvPublicationAvailabilityChanged.make({
        applicationId: link.applicationId,
        contentEntryId: link.contentEntryId,
        contentRevisionId: link.currentRevisionId,
        correlationId: operationId,
        cvLinkId: link.id,
        enabled: link.enabled,
        eventId: `cv-publication-availability-changed:${operationId}`,
        occurredAt: link.updatedAt,
        publicationVersion: link.publicationVersion,
        version: 1,
      })
    )
  )

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

  const resolveStoredLink = Effect.fn('CvPublicationsService.resolveStored')(
    (link: CvLink) =>
      Effect.gen(function* () {
        const entry = yield* requireAssociatedEntry(
          content,
          link.applicationId,
          link.contentEntryId
        )
        yield* requireCvEntry(entry)
        const revision = yield* requireAssociatedRevision(
          content,
          entry.id,
          link.currentRevisionId
        )
        const bytes = yield* readOpaquePayload(store, revision.sha256)
        return { bytes, entry, link, revision }
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
        const applicationLinks = yield* links.findByApplication(application.id)
        const restored = yield* Effect.forEach(
          applicationLinks,
          Effect.fn('CvPublicationsService.restoreReadyLinkAfterRejection')(
            function* (link) {
              if (
                link.enabled ||
                link.disabledReason !== applicationRejectedDisableReason
              ) {
                return 0
              }

              const currentArtifact =
                yield* artifacts.findCurrentForPublication(
                  link.id,
                  link.currentRevisionId,
                  null,
                  link.publicationVersion,
                  link.publicUrl
                )
              if (currentArtifact?.status !== 'ready') return 0

              const enabled = yield* links.setEnabled(
                link.id,
                link.version,
                link.publicationVersion,
                true,
                null,
                yield* registryNow
              )
              return enabled ? 1 : 0
            }
          ),
          { concurrency: 1 }
        )
        return restored.reduce<number>((total, count) => total + count, 0)
      })
    ),
    stage: Effect.fn('CvPublicationsService.stage')(
      (applicationIdentifier: string, entryId: string, input: StageCvInput) =>
        Effect.gen(function* () {
          const operationId = yield* requireNonEmpty(
            input.operationId,
            'CV staging operation ID'
          )
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
          if (input.expectedContentVersion !== entry.version) {
            return yield* new RegistryConflictError({
              message: `Content entry version ${entry.version} does not match expected version ${input.expectedContentVersion}.`,
            })
          }
          const revision = yield* requireAssociatedRevision(
            content,
            entry.id,
            input.revisionId
          )
          const existing = yield* links.findByEntry(entry.id)
          if (existing && existing.applicationId !== application.id) {
            return yield* new RegistryConflictError({
              message: 'The public CV link belongs to another application.',
            })
          }

          const token = existing?.token ?? newRegistryId().replaceAll('-', '')
          const resolvedPublicUrl = yield* publicUrl(input.publicBaseUrl, token)
          const now = yield* registryNow
          const applied = yield* links.stage(
            {
              applicationId: application.id,
              contentEntryId: entry.id,
              createdAt: existing?.createdAt ?? now,
              currentRevisionId: revision.id,
              id: existing?.id ?? newRegistryId(),
              previewToken: newRegistryId().replaceAll('-', ''),
              publicUrl: resolvedPublicUrl,
              token,
              updatedAt: now,
            },
            input.expectedContentVersion
          )
          if (!applied) {
            return yield* new RegistryConflictError({
              message:
                'The content entry or CV page changed while its draft revision was being staged.',
            })
          }
          const staged = yield* links.findByEntry(entry.id)
          if (!staged) {
            return yield* missingRegistryData(
              `CV page was not staged for content entry ${entry.id}.`
            )
          }
          if (
            staged.applicationId !== application.id ||
            staged.currentRevisionId !== revision.id ||
            staged.token !== token
          ) {
            return yield* new RegistryConflictError({
              message:
                'The CV page changed while its draft revision was being staged.',
            })
          }
          yield* events.publish(
            RegistryEventSchema.cases.CvPublicationStaged.make({
              applicationId: staged.applicationId,
              contentEntryId: staged.contentEntryId,
              contentRevisionId: staged.currentRevisionId,
              correlationId: operationId,
              cvLinkId: staged.id,
              eventId: `cv-publication-staged:${operationId}`,
              occurredAt: staged.updatedAt,
              publicationVersion: staged.publicationVersion,
              version: 1,
            })
          )
          return staged
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
        return yield* resolveStoredLink(link)
      })
    ),
    resolvePreview: Effect.fn('CvPublicationsService.resolvePreview')(
      (token: string, previewToken: string) =>
        Effect.gen(function* () {
          const link = yield* links.findByToken(token)
          if (!link || link.previewToken !== previewToken) {
            return yield* new RegistryNotFoundError({
              identifier: token,
              message: `CV preview not found: ${token}`,
            })
          }
          return yield* resolveStoredLink(link)
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
          const operationId = yield* requireNonEmpty(
            input.operationId,
            'CV availability operation ID'
          )
          if (link.enabled === input.enabled) {
            yield* publishAvailabilityChanged(link, operationId)
            return link
          }

          if (input.enabled) {
            if (entry.approvedRevisionId !== link.currentRevisionId) {
              return yield* new RegistryConflictError({
                message:
                  'The staged CV revision must be approved before the page can be made public.',
              })
            }
            yield* requireAssociatedRevision(
              content,
              entry.id,
              link.currentRevisionId
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
          const stored = yield* links
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
          yield* publishAvailabilityChanged(stored, operationId)
          return stored
        })
    ),
  } satisfies CvPublicationsServiceShape
})

export const CvPublicationsServiceLive = Layer.effect(
  CvPublicationsService,
  make
)
