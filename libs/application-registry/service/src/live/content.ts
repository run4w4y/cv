import { ArtifactStore } from '@cv/application-registry-artifact-store'
import {
  ApplicationsCrud,
  ContentCrud,
  JobPostingSnapshotsCrud,
  type PersistedContentRevision,
} from '@cv/application-registry-crud'
import type { ContentRevision } from '@cv/application-registry-entity'
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
  ContentEntriesService,
  type ContentEntriesService as ContentEntriesServiceShape,
} from '../services/content'
import type {
  AppendContentRevisionInput,
  ApproveContentRevisionInput,
  CreateContentEntryInput,
} from '../types'

const revisionMatchesRequest = (
  revision: ContentRevision,
  input: AppendContentRevisionInput,
  sha256: string,
  byteLength: number,
  contractId: string,
  contractVersion: string,
  mediaType: string
) =>
  revision.byteLength === byteLength &&
  revision.contractId === contractId &&
  revision.contractVersion === contractVersion &&
  revision.factsReleaseId === (input.factsReleaseId ?? null) &&
  revision.jobSnapshotId === (input.jobSnapshotId ?? null) &&
  revision.mediaType === mediaType &&
  revision.sha256 === sha256 &&
  revision.source === input.source

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const content = yield* ContentCrud
  const snapshots = yield* JobPostingSnapshotsCrud
  const store = yield* ArtifactStore

  const find = Effect.fn('ContentEntriesService.find')(
    (applicationIdentifier: string, entryId: string) =>
      Effect.gen(function* () {
        const application = yield* findApplicationForContent(
          applications,
          applicationIdentifier
        )
        return yield* requireAssociatedEntry(content, application.id, entryId)
      })
  )

  return {
    appendRevision: Effect.fn('ContentEntriesService.appendRevision')(
      (
        applicationIdentifier: string,
        entryId: string,
        input: AppendContentRevisionInput
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
          const contractId = yield* requireNonEmpty(
            input.contractId,
            'Contract ID'
          )
          const contractVersion = yield* requireNonEmpty(
            input.contractVersion,
            'Contract version'
          )
          const mediaType = yield* requireNonEmpty(
            input.payload.mediaType,
            'Payload media type'
          )
          yield* requireNonEmpty(input.operationId, 'Operation ID')

          if (input.jobSnapshotId) {
            const snapshot = yield* snapshots.find(input.jobSnapshotId)
            if (!snapshot || snapshot.applicationId !== application.id) {
              return yield* new RegistryNotFoundError({
                identifier: input.jobSnapshotId,
                message: `Job posting snapshot not found: ${input.jobSnapshotId}`,
              })
            }
          }

          const storedPayload = yield* putOpaquePayload(store, input.payload)
          const revisions = yield* content.listRevisions(entry.id)
          const replay = revisions.find(
            ({ operationId }) => operationId === input.operationId
          )
          if (replay) {
            if (
              !revisionMatchesRequest(
                replay,
                input,
                storedPayload.sha256,
                storedPayload.byteLength,
                contractId,
                contractVersion,
                mediaType
              )
            ) {
              return yield* new RegistryConflictError({
                message:
                  'The operation ID is already used by a different content revision.',
              })
            }
            return { entry, revision: replay }
          }

          if (input.expectedVersion !== entry.version) {
            return yield* new RegistryConflictError({
              message: `Content entry version ${entry.version} does not match expected version ${input.expectedVersion}.`,
            })
          }

          const parent = entry.headRevisionId
            ? yield* requireAssociatedRevision(
                content,
                entry.id,
                entry.headRevisionId
              )
            : null
          const createdAt = yield* registryNow
          const revision: PersistedContentRevision = {
            byteLength: storedPayload.byteLength,
            contentEntryId: entry.id,
            contractId,
            contractVersion,
            createdAt,
            factsReleaseId: input.factsReleaseId ?? null,
            id: newRegistryId(),
            jobSnapshotId: input.jobSnapshotId ?? null,
            mediaType,
            objectKey: storedPayload.key,
            operationId: input.operationId,
            parentRevisionId: parent?.id ?? null,
            revisionNumber: (parent?.revisionNumber ?? 0) + 1,
            sha256: storedPayload.sha256,
            source: input.source,
          }
          const appended = yield* content.appendRevision(
            revision,
            entry.version,
            createdAt
          )
          if (!appended) {
            return yield* new RegistryConflictError({
              message:
                'The content entry changed while the revision was being saved.',
            })
          }

          const [updatedEntry, storedRevision] = yield* Effect.all([
            content.findEntry(entry.id),
            content.findRevision(revision.id),
          ])
          if (!updatedEntry || !storedRevision) {
            return yield* missingRegistryData(
              `Content revision was not persisted: ${revision.id}`
            )
          }
          return { entry: updatedEntry, revision: storedRevision }
        })
    ),
    approveRevision: Effect.fn('ContentEntriesService.approveRevision')(
      (
        applicationIdentifier: string,
        entryId: string,
        input: ApproveContentRevisionInput
      ) =>
        Effect.gen(function* () {
          const entry = yield* find(applicationIdentifier, entryId)
          if (input.expectedVersion !== entry.version) {
            return yield* new RegistryConflictError({
              message: `Content entry version ${entry.version} does not match expected version ${input.expectedVersion}.`,
            })
          }
          const revision = yield* requireAssociatedRevision(
            content,
            entry.id,
            input.revisionId
          )
          if (entry.headRevisionId !== revision.id) {
            return yield* new RegistryConflictError({
              message: 'Only the current head revision can be approved.',
            })
          }

          const updatedAt = yield* registryNow
          const approved = yield* content.approve(
            entry.id,
            revision.id,
            entry.version,
            updatedAt
          )
          if (!approved) {
            return yield* new RegistryConflictError({
              message:
                'The content entry changed while the revision was being approved.',
            })
          }
          const updatedEntry = yield* content.findEntry(entry.id)
          if (!updatedEntry) {
            return yield* missingRegistryData(
              `Approved content entry disappeared: ${entry.id}`
            )
          }
          return { entry: updatedEntry, revision }
        })
    ),
    ensure: Effect.fn('ContentEntriesService.ensure')(
      (applicationIdentifier: string, input: CreateContentEntryInput) =>
        Effect.gen(function* () {
          const application = yield* findApplicationForContent(
            applications,
            applicationIdentifier
          )
          const locale = yield* requireNonEmpty(input.locale, 'Locale')
          if (locale !== 'en') {
            return yield* new RegistryBadRequestError({
              message: `Unsupported content locale: ${locale}. Only en is supported.`,
            })
          }
          const existing = yield* content.findEntryByApplication(
            application.id,
            input.kind,
            locale
          )
          if (existing) return existing

          const now = yield* registryNow
          yield* content.createEntry({
            applicationId: application.id,
            createdAt: now,
            id: newRegistryId(),
            kind: input.kind,
            locale,
            updatedAt: now,
          })
          const stored = yield* content.findEntryByApplication(
            application.id,
            input.kind,
            locale
          )
          if (!stored) {
            return yield* missingRegistryData(
              `Content entry was not persisted for application ${application.id}.`
            )
          }
          return stored
        })
    ),
    find,
    listRevisions: Effect.fn('ContentEntriesService.listRevisions')(
      (applicationIdentifier: string, entryId: string) =>
        Effect.gen(function* () {
          const entry = yield* find(applicationIdentifier, entryId)
          return yield* content.listRevisions(entry.id)
        })
    ),
    readRevision: Effect.fn('ContentEntriesService.readRevision')(
      (applicationIdentifier: string, entryId: string, revisionId: string) =>
        Effect.gen(function* () {
          const entry = yield* find(applicationIdentifier, entryId)
          const revision = yield* requireAssociatedRevision(
            content,
            entry.id,
            revisionId
          )
          const bytes = yield* readOpaquePayload(store, revision.sha256)
          return { bytes, entry, revision }
        })
    ),
  } satisfies ContentEntriesServiceShape
})

export const ContentEntriesServiceLive = Layer.effect(
  ContentEntriesService,
  make
)
