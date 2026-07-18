import { ArtifactStore } from '@cv/application-registry-artifact-store'
import {
  ApplicationsCrud,
  ArtifactsCrud,
  ContentCrud,
  CvLinksCrud,
} from '@cv/application-registry-crud'
import type { GeneratedArtifact } from '@cv/application-registry-entity'
import { Effect, Layer } from 'effect'

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
import type { BeginPdfArtifactInput } from '../types'

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
        const artifact = yield* artifacts.findReadyForPublication(
          link.id,
          link.publishedRevisionId,
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

  return {
    begin: Effect.fn('PdfArtifactsService.begin')(
      (
        applicationIdentifier: string,
        entryId: string,
        input: BeginPdfArtifactInput
      ) =>
        Effect.gen(function* () {
          const rendererVersion = yield* requireNonEmpty(
            input.rendererVersion,
            'Renderer version'
          )
          const workflowId = yield* requireNonEmpty(
            input.workflowId,
            'Workflow ID'
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
          if (!link.enabled) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link must be enabled while its PDF is rendered.',
            })
          }
          if (link.publicationVersion !== input.expectedPublicationVersion) {
            return yield* new RegistryConflictError({
              message: `Public CV publication version ${link.publicationVersion} does not match expected version ${input.expectedPublicationVersion}.`,
            })
          }
          if (entry.approvedRevisionId !== link.publishedRevisionId) {
            return yield* new RegistryConflictError({
              message:
                'The public CV link is not pinned to the approved content revision.',
            })
          }
          yield* requireAssociatedRevision(
            content,
            entry.id,
            link.publishedRevisionId
          )

          const existing = yield* artifacts.findByWorkflowId(workflowId)
          if (existing) {
            if (
              existing.cvLinkId !== link.id ||
              existing.contentRevisionId !== link.publishedRevisionId ||
              existing.kind !== 'pdf' ||
              existing.rendererVersion !== rendererVersion ||
              existing.publicationVersion !== link.publicationVersion ||
              existing.qrTarget !== link.publicUrl
            ) {
              return yield* new RegistryConflictError({
                message:
                  'The Workflow ID already belongs to a different PDF attempt.',
              })
            }
            return existing
          }

          const now = yield* registryNow
          const pending: GeneratedArtifact = {
            byteLength: null,
            contentRevisionId: link.publishedRevisionId,
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
            rendererVersion,
            sha256: null,
            status: 'pending',
            updatedAt: now,
            workflowId,
          }
          yield* artifacts.persistPending(pending)
          const stored = yield* artifacts.findByWorkflowId(workflowId)
          if (!stored) {
            return yield* missingRegistryData(
              `Pending PDF artifact was not persisted: ${pending.id}`
            )
          }
          if (
            stored.cvLinkId !== link.id ||
            stored.contentRevisionId !== link.publishedRevisionId ||
            stored.rendererVersion !== rendererVersion ||
            stored.publicationVersion !== link.publicationVersion ||
            stored.qrTarget !== link.publicUrl
          ) {
            return yield* new RegistryConflictError({
              message:
                'The PDF artifact changed while the render was being started.',
            })
          }
          return stored
        })
    ),
    complete: Effect.fn('PdfArtifactsService.complete')(
      (applicationIdentifier: string, artifactId: string, bytes: Uint8Array) =>
        Effect.gen(function* () {
          const { artifact } = yield* findArtifactForApplication(
            applicationIdentifier,
            artifactId
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
              artifact.mediaType === 'application/pdf'
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
          const { artifact } = yield* findArtifactForApplication(
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
          return yield* artifacts
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
