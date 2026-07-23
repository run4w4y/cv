import { ArtifactStore } from '@cv/application-registry-artifact-store'
import {
  ApplicationsCrud,
  ArtifactsCrud,
  ContentCrud,
  CvLinksCrud,
} from '@cv/application-registry-crud'
import {
  type GeneratedArtifact,
  pdfGenerationFailedDisableReason,
} from '@cv/application-registry-entity'
import {
  type PdfGenerationTriggerEvent,
  publishRegistryEventBestEffort,
  RegistryEventPublisher,
  RegistryEventSchema,
} from '@cv/application-registry-events'
import { Effect, Layer, Result } from 'effect'

import {
  RegistryBadRequestError,
  RegistryConflictError,
  RegistryNotFoundError,
} from '../errors'
import {
  findApplicationForContent,
  putOpaquePayload,
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
  PdfArtifactsService,
  type PdfArtifactsService as PdfArtifactsServiceShape,
} from '../services/pdf-artifacts'
import type { RequestPdfGenerationInput } from '../types'

const pendingRendererVersion = 'pending:cv-application'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const artifacts = yield* ArtifactsCrud
  const content = yield* ContentCrud
  const links = yield* CvLinksCrud
  const store = yield* ArtifactStore
  const events = yield* RegistryEventPublisher

  const findArtifactForApplication = Effect.fn(
    'PdfArtifactsService.findArtifactForApplication'
  )((applicationIdentifier: string, artifactId: string) =>
    Effect.gen(function* () {
      const application = yield* findApplicationForContent(
        applications,
        applicationIdentifier
      )
      const artifact = yield* artifacts.find(artifactId)
      if (!artifact) {
        return yield* new RegistryNotFoundError({
          identifier: artifactId,
          message: `PDF artifact not found: ${artifactId}`,
        })
      }
      const revision = yield* content.findRevision(artifact.contentRevisionId)
      if (!revision) {
        return yield* missingRegistryData(
          `PDF artifact ${artifact.id} references a missing content revision.`
        )
      }
      const entry = yield* requireAssociatedEntry(
        content,
        application.id,
        revision.contentEntryId
      )
      const link = yield* links.findByEntry(entry.id)
      if (!link || link.id !== artifact.cvLinkId) {
        return yield* new RegistryNotFoundError({
          identifier: artifactId,
          message: `PDF artifact not found: ${artifactId}`,
        })
      }
      return { artifact, entry, link, revision }
    })
  )

  const validateAttemptIdentity = Effect.fn(
    'PdfArtifactsService.validateAttemptIdentity'
  )(function* (
    existing: GeneratedArtifact,
    expected: {
      readonly contentRevisionId: string
      readonly cvLinkId: string
      readonly publicationVersion: number
      readonly qrTarget: string
    }
  ) {
    if (
      existing.cvLinkId !== expected.cvLinkId ||
      existing.contentRevisionId !== expected.contentRevisionId ||
      existing.kind !== 'pdf' ||
      existing.publicationVersion !== expected.publicationVersion ||
      existing.qrTarget !== expected.qrTarget
    ) {
      return yield* new RegistryConflictError({
        message:
          'The PDF request ID already belongs to a different generation attempt.',
      })
    }
    return existing
  })

  const findCurrent = Effect.fn('PdfArtifactsService.findCurrent')(
    (
      applicationIdentifier: string,
      entryId: string,
      rendererVersion?: string
    ) =>
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
        if (entry.kind !== 'cv') {
          return yield* new RegistryBadRequestError({
            message: 'PDF artifacts can only be generated for CV content.',
          })
        }
        const link = yield* links.findByEntry(entry.id)
        if (!link || link.applicationId !== application.id) {
          return yield* new RegistryNotFoundError({
            identifier: entry.id,
            message: `Public CV link not found for content entry ${entry.id}.`,
          })
        }
        const artifact = yield* artifacts.findCurrentForPublication(
          link.id,
          link.currentRevisionId,
          rendererVersion ?? null,
          link.publicationVersion,
          link.publicUrl
        )
        if (!artifact) {
          return yield* new RegistryNotFoundError({
            identifier: `${link.id}:${rendererVersion ?? 'any-renderer'}`,
            message: `Current PDF artifact not found for public CV link ${link.id}.`,
          })
        }
        return artifact
      })
  )

  const requirePendingArtifact = (artifact: GeneratedArtifact) =>
    artifact.status === 'pending'
      ? Effect.succeed(artifact)
      : Effect.fail(
          new RegistryConflictError({
            message: `PDF artifact ${artifact.id} is already ${artifact.status}.`,
          })
        )

  const disableFailedPublication = Effect.fn(
    'PdfArtifactsService.disableFailedPublication'
  )(function* (entryId: string, artifact: GeneratedArtifact) {
    const link = yield* links.findByEntry(entryId)
    if (
      !link ||
      link.id !== artifact.cvLinkId ||
      link.currentRevisionId !== artifact.contentRevisionId ||
      link.publicationVersion !== artifact.publicationVersion ||
      link.publicUrl !== artifact.qrTarget
    ) {
      return false
    }
    if (!link.enabled) {
      return link.disabledReason === pdfGenerationFailedDisableReason
    }

    const current = yield* artifacts.findCurrentForPublication(
      link.id,
      link.currentRevisionId,
      null,
      link.publicationVersion,
      link.publicUrl
    )
    if (current?.id !== artifact.id) {
      return false
    }

    const disabled = yield* links.disableForFailedArtifact(
      link.id,
      link.version,
      artifact,
      pdfGenerationFailedDisableReason,
      yield* registryNow
    )
    return disabled
  })

  const publishPublicationChanged = Effect.fn(
    'PdfArtifactsService.publishPublicationChanged'
  )(
    (
      applicationId: string,
      artifact: GeneratedArtifact,
      publicationChanged: boolean
    ) =>
      publicationChanged
        ? publishRegistryEventBestEffort(
            events,
            RegistryEventSchema.cases.CvPublicationChanged.make({
              applicationId,
              correlationId: artifact.requestId,
              eventId: `cv-publication-changed:${applicationId}:${artifact.requestId}`,
              occurredAt: artifact.updatedAt,
              version: 1,
            })
          )
        : Effect.void
  )

  return {
    ensureAttempt: Effect.fn('PdfArtifactsService.ensureAttempt')(
      (event: PdfGenerationTriggerEvent) =>
        Effect.gen(function* () {
          const requestId = yield* requireNonEmpty(
            event.eventId,
            'PDF request ID'
          )
          const application = yield* findApplicationForContent(
            applications,
            event.applicationId
          )
          const entry = yield* requireAssociatedEntry(
            content,
            application.id,
            event.contentEntryId
          )
          if (entry.kind !== 'cv') {
            return yield* new RegistryBadRequestError({
              message: 'PDF artifacts can only be generated for CV content.',
            })
          }
          const link = yield* links.findByEntry(entry.id)
          if (!link || link.applicationId !== application.id) {
            return yield* new RegistryNotFoundError({
              identifier: entry.id,
              message: `Public CV link not found for content entry ${entry.id}.`,
            })
          }
          if (
            link.id !== event.cvLinkId ||
            link.currentRevisionId !== event.contentRevisionId ||
            link.publicationVersion !== event.publicationVersion
          ) {
            return yield* new RegistryConflictError({
              message:
                'The current CV publication no longer matches the generation event.',
            })
          }
          yield* requireAssociatedRevision(
            content,
            entry.id,
            link.currentRevisionId
          )

          const identity = {
            contentRevisionId: link.currentRevisionId,
            cvLinkId: link.id,
            publicationVersion: link.publicationVersion,
            qrTarget: link.publicUrl,
          }
          const existing = yield* artifacts.findByRequestId(requestId)
          if (existing) {
            const validated = yield* validateAttemptIdentity(existing, identity)
            if (validated.status === 'failed') {
              yield* publishPublicationChanged(
                application.id,
                validated,
                !link.enabled &&
                  link.disabledReason === pdfGenerationFailedDisableReason
              )
            }
            return validated
          }

          if (!link.enabled) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link must be temporarily enabled before PDF generation starts.',
            })
          }
          if (entry.approvedRevisionId !== link.currentRevisionId) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link is not pinned to the approved content revision.',
            })
          }

          const now = yield* registryNow
          const pending: GeneratedArtifact = {
            byteLength: null,
            contentRevisionId: link.currentRevisionId,
            createdAt: now,
            cvLinkId: link.id,
            errorCode: null,
            errorMessage: null,
            generatedAt: null,
            id: newRegistryId(),
            kind: 'pdf',
            mediaType: null,
            objectKey: null,
            publicationVersion: link.publicationVersion,
            qrTarget: link.publicUrl,
            rendererVersion: pendingRendererVersion,
            sha256: null,
            status: 'pending',
            updatedAt: now,
            requestId,
          }
          const persisted = yield* Effect.result(
            artifacts.persistPending(pending, link.version)
          )
          const stored = yield* artifacts.findByRequestId(requestId)
          if (!stored) {
            if (Result.isFailure(persisted)) return yield* persisted.failure
            return yield* new RegistryConflictError({
              message:
                'The public CV link changed while PDF generation was starting.',
            })
          }
          return yield* validateAttemptIdentity(stored, identity)
        })
    ),
    requestGeneration: Effect.fn('PdfArtifactsService.requestGeneration')(
      (
        applicationIdentifier: string,
        entryId: string,
        input: RequestPdfGenerationInput
      ) =>
        Effect.gen(function* () {
          const operationId = yield* requireNonEmpty(
            input.operationId,
            'PDF generation operation ID'
          )
          const eventId = `pdf-generation-requested:${operationId}`
          const application = yield* findApplicationForContent(
            applications,
            applicationIdentifier
          )
          const entry = yield* requireAssociatedEntry(
            content,
            application.id,
            entryId
          )
          if (entry.kind !== 'cv') {
            return yield* new RegistryBadRequestError({
              message: 'PDF artifacts can only be generated for CV content.',
            })
          }
          const link = yield* links.findByEntry(entry.id)
          if (!link || link.applicationId !== application.id) {
            return yield* new RegistryNotFoundError({
              identifier: entry.id,
              message: `Public CV link not found for content entry ${entry.id}.`,
            })
          }
          if (link.publicationVersion !== input.expectedPublicationVersion) {
            return yield* new RegistryConflictError({
              message: `Public CV publication version ${link.publicationVersion} does not match expected version ${input.expectedPublicationVersion}.`,
            })
          }
          if (!link.enabled) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link must be enabled before PDF generation starts.',
            })
          }
          if (entry.approvedRevisionId !== link.currentRevisionId) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link is not pinned to the approved content revision.',
            })
          }
          yield* events.publish(
            RegistryEventSchema.cases.PdfGenerationRequested.make({
              applicationId: application.id,
              contentEntryId: entry.id,
              contentRevisionId: link.currentRevisionId,
              correlationId: operationId,
              cvLinkId: link.id,
              eventId,
              occurredAt: yield* registryNow,
              publicationVersion: link.publicationVersion,
              version: 1,
            })
          )
          return { eventId }
        })
    ),
    complete: Effect.fn('PdfArtifactsService.complete')(
      (
        applicationIdentifier: string,
        artifactId: string,
        rendererVersionInput: string,
        bytes: Uint8Array
      ) =>
        Effect.gen(function* () {
          const { artifact, link } = yield* findArtifactForApplication(
            applicationIdentifier,
            artifactId
          )
          if (
            link.currentRevisionId !== artifact.contentRevisionId ||
            link.publicationVersion !== artifact.publicationVersion ||
            link.publicUrl !== artifact.qrTarget
          ) {
            return yield* new RegistryConflictError({
              message:
                'The current CV publication no longer matches the PDF generation attempt.',
            })
          }
          const rendererVersion = yield* requireNonEmpty(
            rendererVersionInput,
            'Renderer version'
          )
          const storedPayload = yield* putOpaquePayload(store, {
            bytes,
            mediaType: 'application/pdf',
          })
          if (artifact.status === 'ready') {
            if (
              artifact.sha256 === storedPayload.sha256 &&
              artifact.byteLength === storedPayload.byteLength &&
              artifact.objectKey === storedPayload.key &&
              artifact.mediaType === 'application/pdf' &&
              artifact.rendererVersion === rendererVersion
            ) {
              return artifact
            }
            return yield* new RegistryConflictError({
              message:
                'The PDF artifact is already complete with different bytes.',
            })
          }
          yield* requirePendingArtifact(artifact)

          const now = yield* registryNow
          const ready: GeneratedArtifact = {
            ...artifact,
            byteLength: storedPayload.byteLength,
            errorCode: null,
            errorMessage: null,
            generatedAt: now,
            mediaType: 'application/pdf',
            objectKey: storedPayload.key,
            rendererVersion,
            sha256: storedPayload.sha256,
            status: 'ready',
            updatedAt: now,
          }
          const updated = yield* artifacts.markReady(ready)
          if (!updated) {
            return yield* new RegistryConflictError({
              message:
                'The PDF artifact changed while completion was being recorded.',
            })
          }
          const completed = yield* artifacts
            .find(artifact.id)
            .pipe(
              Effect.flatMap((stored) =>
                stored
                  ? Effect.succeed(stored)
                  : Effect.fail(
                      missingRegistryData(
                        `Completed PDF artifact disappeared: ${artifact.id}`
                      )
                    )
              )
            )
          return completed
        })
    ),
    fail: Effect.fn('PdfArtifactsService.fail')(
      (
        applicationIdentifier: string,
        artifactId: string,
        errorCode: string,
        errorMessage: string
      ) =>
        Effect.gen(function* () {
          const { artifact, entry } = yield* findArtifactForApplication(
            applicationIdentifier,
            artifactId
          )
          const code = yield* requireNonEmpty(errorCode, 'PDF error code')
          const message = yield* requireNonEmpty(
            errorMessage,
            'PDF error message'
          )
          if (artifact.status === 'failed') {
            if (
              artifact.errorCode === code &&
              artifact.errorMessage === message
            ) {
              const publicationChange = yield* disableFailedPublication(
                entry.id,
                artifact
              )
              yield* publishPublicationChanged(
                entry.applicationId,
                artifact,
                publicationChange
              )
              return artifact
            }
            return yield* new RegistryConflictError({
              message:
                'The PDF artifact has already failed with a different error.',
            })
          }
          yield* requirePendingArtifact(artifact)
          const updated = yield* artifacts.markFailed(
            artifact.id,
            code,
            message,
            yield* registryNow
          )
          if (!updated) {
            return yield* new RegistryConflictError({
              message:
                'The PDF artifact changed while its failure was being recorded.',
            })
          }
          const failed = yield* artifacts
            .find(artifact.id)
            .pipe(
              Effect.flatMap((stored) =>
                stored
                  ? Effect.succeed(stored)
                  : Effect.fail(
                      missingRegistryData(
                        `Failed PDF artifact disappeared: ${artifact.id}`
                      )
                    )
              )
            )
          const publicationChange = yield* disableFailedPublication(
            entry.id,
            failed
          )
          yield* publishPublicationChanged(
            entry.applicationId,
            failed,
            publicationChange
          )
          return failed
        })
    ),
    findAttempt: Effect.fn('PdfArtifactsService.findAttempt')(
      (applicationIdentifier: string, entryId: string, artifactId: string) =>
        Effect.gen(function* () {
          const attempt = yield* findArtifactForApplication(
            applicationIdentifier,
            artifactId
          )
          if (attempt.entry.id !== entryId) {
            return yield* new RegistryNotFoundError({
              identifier: artifactId,
              message: `PDF generation attempt not found: ${artifactId}`,
            })
          }
          return attempt
        })
    ),
    findCurrent,
    readCurrent: Effect.fn('PdfArtifactsService.readCurrent')(
      (
        applicationIdentifier: string,
        entryId: string,
        rendererVersion?: string
      ) =>
        Effect.gen(function* () {
          const artifact = yield* findCurrent(
            applicationIdentifier,
            entryId,
            rendererVersion
          )
          if (artifact.status !== 'ready' || !artifact.sha256) {
            return yield* new RegistryConflictError({
              message: `PDF artifact ${artifact.id} is not ready.`,
            })
          }
          const bytes = yield* readOpaquePayload(store, artifact.sha256)
          return { artifact, bytes }
        })
    ),
  } satisfies PdfArtifactsServiceShape
})

export const PdfArtifactsServiceLive = Layer.effect(PdfArtifactsService, make)
