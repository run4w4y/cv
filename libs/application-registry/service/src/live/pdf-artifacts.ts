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
import type { StartPdfJobInput } from '../types'

const pendingRendererVersion = 'pending:cv-application'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const artifacts = yield* ArtifactsCrud
  const content = yield* ContentCrud
  const links = yield* CvLinksCrud
  const store = yield* ArtifactStore

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

  const validateJobIdentity = Effect.fn(
    'PdfArtifactsService.validateJobIdentity'
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
        message: 'The PDF request ID already belongs to a different job.',
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
      !link?.enabled ||
      link.id !== artifact.cvLinkId ||
      link.currentRevisionId !== artifact.contentRevisionId ||
      link.publicationVersion !== artifact.publicationVersion ||
      link.publicUrl !== artifact.qrTarget
    ) {
      return
    }

    const current = yield* artifacts.findCurrentForPublication(
      link.id,
      link.currentRevisionId,
      null,
      link.publicationVersion,
      link.publicUrl
    )
    if (current?.id !== artifact.id) {
      return
    }

    yield* links.disableForFailedArtifact(
      link.id,
      link.version,
      artifact,
      pdfGenerationFailedDisableReason,
      yield* registryNow
    )
  })

  return {
    startJob: Effect.fn('PdfArtifactsService.startJob')(
      (
        applicationIdentifier: string,
        entryId: string,
        input: StartPdfJobInput
      ) =>
        Effect.gen(function* () {
          const requestId = yield* requireNonEmpty(
            input.requestId,
            'PDF request ID'
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
                'The public CV link must be temporarily enabled before PDF generation starts.',
            })
          }
          if (entry.approvedRevisionId !== link.currentRevisionId) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link is not pinned to the approved content revision.',
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
            return yield* validateJobIdentity(existing, identity)
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
            artifacts.persistPending(
              pending,
              {
                applicationId: application.id,
                artifactId: pending.id,
                attempts: 0,
                contentEntryId: entry.id,
                createdAt: now,
                dispatchedAt: null,
                lastAttemptAt: null,
                lastError: null,
                messageVersion: 1,
                updatedAt: now,
              },
              link.version
            )
          )
          const stored = yield* artifacts.findByRequestId(requestId)
          if (!stored) {
            if (Result.isFailure(persisted)) return yield* persisted.failure
            return yield* new RegistryConflictError({
              message:
                'The public CV link changed while PDF generation was starting.',
            })
          }
          return yield* validateJobIdentity(stored, identity)
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
          const { artifact } = yield* findArtifactForApplication(
            applicationIdentifier,
            artifactId
          )
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
          return yield* artifacts
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
              yield* disableFailedPublication(entry.id, artifact)
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
          yield* disableFailedPublication(entry.id, failed)
          return failed
        })
    ),
    findJob: Effect.fn('PdfArtifactsService.findJob')(
      (applicationIdentifier: string, entryId: string, artifactId: string) =>
        Effect.gen(function* () {
          const job = yield* findArtifactForApplication(
            applicationIdentifier,
            artifactId
          )
          if (job.entry.id !== entryId) {
            return yield* new RegistryNotFoundError({
              identifier: artifactId,
              message: `PDF job not found: ${artifactId}`,
            })
          }
          return job
        })
    ),
    findPendingDispatch: Effect.fn('PdfArtifactsService.findPendingDispatch')(
      (artifactId: string) => artifacts.findPendingDispatch(artifactId)
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
    markDispatchFailed: Effect.fn('PdfArtifactsService.markDispatchFailed')(
      (artifactId: string, message: string) =>
        Effect.gen(function* () {
          yield* artifacts.markDispatchFailed(
            artifactId,
            message.slice(0, 2_000),
            yield* registryNow
          )
        })
    ),
    markDispatched: Effect.fn('PdfArtifactsService.markDispatched')(
      (artifactId: string) =>
        Effect.gen(function* () {
          yield* artifacts.markDispatched(artifactId, yield* registryNow)
        })
    ),
    pendingDispatches: Effect.fn('PdfArtifactsService.pendingDispatches')(
      (limit: number) => artifacts.pendingDispatches(limit)
    ),
  } satisfies PdfArtifactsServiceShape
})

export const PdfArtifactsServiceLive = Layer.effect(PdfArtifactsService, make)
