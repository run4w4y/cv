import { ArtifactStore } from '@cv/application-registry-artifact-store'
import {
  ApplicationsCrud,
  JobPostingSnapshotsCrud,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { RegistryNotFoundError } from '../errors'
import {
  findApplicationForContent,
  putOpaquePayload,
  readOpaquePayload,
  requireNonEmpty,
} from '../internal/opaque-content'
import {
  missingRegistryData,
  newRegistryId,
  registryNow,
} from '../internal/shared'
import {
  JobPostingSnapshotsService,
  type JobPostingSnapshotsService as JobPostingSnapshotsServiceShape,
} from '../services/job-posting-snapshots'
import type {
  JobPostingSnapshotPayloadKind,
  OpaquePayloadInput,
  PersistJobPostingSnapshotInput,
} from '../types'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const snapshots = yield* JobPostingSnapshotsCrud
  const store = yield* ArtifactStore

  const find = Effect.fn('JobPostingSnapshotsService.find')(
    (applicationIdentifier: string, snapshotId: string) =>
      Effect.gen(function* () {
        const application = yield* findApplicationForContent(
          applications,
          applicationIdentifier
        )
        const snapshot = yield* snapshots.find(snapshotId)
        if (!snapshot || snapshot.applicationId !== application.id) {
          return yield* new RegistryNotFoundError({
            identifier: snapshotId,
            message: `Job posting snapshot not found: ${snapshotId}`,
          })
        }
        return snapshot
      })
  )

  const storePayload = (input: OpaquePayloadInput | null | undefined) =>
    input
      ? putOpaquePayload(store, input).pipe(
          Effect.map((metadata) => ({ metadata, mediaType: input.mediaType }))
        )
      : Effect.succeed(null)

  return {
    find,
    latest: Effect.fn('JobPostingSnapshotsService.latest')(
      (applicationIdentifier: string) =>
        Effect.gen(function* () {
          const application = yield* findApplicationForContent(
            applications,
            applicationIdentifier
          )
          const snapshot = yield* snapshots.latest(application.id)
          if (!snapshot) {
            return yield* new RegistryNotFoundError({
              identifier: application.id,
              message: `No job posting snapshot exists for application ${application.id}.`,
            })
          }
          return snapshot
        })
    ),
    persist: Effect.fn('JobPostingSnapshotsService.persist')(
      (applicationIdentifier: string, input: PersistJobPostingSnapshotInput) =>
        Effect.gen(function* () {
          const application = yield* findApplicationForContent(
            applications,
            applicationIdentifier
          )
          const requestedUrl = yield* requireNonEmpty(
            input.requestedUrl,
            'Requested URL'
          )
          const fetcherVersion = yield* requireNonEmpty(
            input.fetcherVersion,
            'Fetcher version'
          )
          const [raw, normalized] = yield* Effect.all([
            storePayload(input.raw),
            storePayload(input.normalized),
          ])
          const id = newRegistryId()
          yield* snapshots.persist({
            applicationId: application.id,
            errorCode: input.status === 'failed' ? input.errorCode : null,
            errorMessage: input.status === 'failed' ? input.errorMessage : null,
            fetchedAt: yield* registryNow,
            fetcherVersion,
            finalUrl: input.finalUrl,
            id,
            normalizedByteLength: normalized?.metadata.byteLength ?? null,
            normalizedMediaType: normalized?.mediaType ?? null,
            normalizedObjectKey: normalized?.metadata.key ?? null,
            normalizedSha256: normalized?.metadata.sha256 ?? null,
            rawByteLength: raw?.metadata.byteLength ?? null,
            rawMediaType: raw?.mediaType ?? null,
            rawObjectKey: raw?.metadata.key ?? null,
            rawSha256: raw?.metadata.sha256 ?? null,
            requestedUrl,
            status: input.status,
          })
          const stored = yield* snapshots
            .find(id)
            .pipe(
              Effect.flatMap((stored) =>
                stored
                  ? Effect.succeed(stored)
                  : Effect.fail(
                      missingRegistryData(
                        `Job posting snapshot was not persisted: ${id}`
                      )
                    )
              )
            )
          return stored
        })
    ),
    readPayload: Effect.fn('JobPostingSnapshotsService.readPayload')(
      (
        applicationIdentifier: string,
        snapshotId: string,
        kind: JobPostingSnapshotPayloadKind
      ) =>
        Effect.gen(function* () {
          const snapshot = yield* find(applicationIdentifier, snapshotId)
          const sha256 =
            kind === 'raw' ? snapshot.rawSha256 : snapshot.normalizedSha256
          if (!sha256) {
            return yield* new RegistryNotFoundError({
              identifier: `${snapshotId}:${kind}`,
              message: `Job posting snapshot ${snapshotId} has no ${kind} payload.`,
            })
          }
          return yield* readOpaquePayload(store, sha256)
        })
    ),
  } satisfies JobPostingSnapshotsServiceShape
})

export const JobPostingSnapshotsServiceLive = Layer.effect(
  JobPostingSnapshotsService,
  make
)
