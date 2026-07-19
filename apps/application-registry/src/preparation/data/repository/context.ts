import type { AiProviderShape } from '@cv/ai-provider'
import type { JobPostingSnapshot } from '@cv/application-registry-entity'
import { FactsCatalogueV1Schema } from '@cv/contracts/facts'
import { Effect, Schema } from 'effect'

import type { RegistryClient } from '../../../lib/registry-client'
import { startApplicationPreparation } from '../../application-lifecycle'
import type { PreparationContextIdentity, PreparationIdentity } from '../keys'
import type {
  ManualJobContextInput,
  PreparationRepositoryShape,
} from '../types'
import { PreparationDataError } from '../types'
import { dataError, decodeOpaqueValue, encodeOpaqueText } from './shared'

export const manualJobContextMaxBytes = 256 * 1_024
export const manualJobContextFetcherVersion =
  'application-registry-management-job-context/v1'

export const makePreparationContextRepository = (
  registry: RegistryClient['Service'],
  ai: AiProviderShape,
  loadContentHead: PreparationRepositoryShape['loadContentHead']
) => {
  const latestSnapshotOrNull = Effect.fn(
    'PreparationRepository.latestSnapshotOrNull'
  )((applicationId: string) =>
    registry.registry
      .getLatestJobPostingSnapshot({ params: { id: applicationId } })
      .pipe(
        Effect.map((snapshot): JobPostingSnapshot | null => snapshot),
        Effect.catchTag('NotFoundError', () =>
          Effect.succeed<JobPostingSnapshot | null>(null)
        )
      )
  )

  const readOrCaptureSnapshot = Effect.fn(
    'PreparationRepository.readOrCaptureSnapshot'
  )(function* (applicationId: string) {
    const latest = yield* latestSnapshotOrNull(applicationId)
    if (latest !== null) return latest
    return yield* registry.registry.captureJobPostingSnapshot({
      params: { id: applicationId },
    })
  })

  const loadContext = Effect.fn('PreparationRepository.loadContext')(
    function* (identity: PreparationContextIdentity) {
      const loaded = yield* Effect.all(
        {
          factsRelease: registry.registry.getActiveFactsRelease({
            query: { locale: identity.locale },
          }),
          jobSnapshot: readOrCaptureSnapshot(identity.applicationId),
        },
        { concurrency: 2 }
      )
      const { jobSnapshot } = loaded
      if (jobSnapshot.status === 'failed') {
        return yield* Effect.fail(
          new PreparationDataError({
            message:
              jobSnapshot.errorMessage ?? 'The latest job snapshot failed.',
            operation: 'load-preparation-context',
          })
        )
      }

      const payloadKind =
        jobSnapshot.normalizedObjectKey !== null
          ? 'normalized'
          : jobSnapshot.rawObjectKey !== null
            ? 'raw'
            : null
      if (payloadKind === null) {
        return yield* Effect.fail(
          new PreparationDataError({
            message:
              'The latest job snapshot does not contain a readable payload.',
            operation: 'load-preparation-context',
          })
        )
      }

      const jobPayload = yield* registry.registry.getJobPostingSnapshotPayload({
        params: {
          id: identity.applicationId,
          kind: payloadKind,
          snapshotId: jobSnapshot.id,
        },
      })
      const factsValue = yield* decodeOpaqueValue(
        'decode-facts-catalogue',
        loaded.factsRelease.catalogue
      )
      const factsCatalogue = yield* Schema.decodeUnknownEffect(
        FactsCatalogueV1Schema
      )(factsValue).pipe(dataError('decode-facts-catalogue'))
      if (factsCatalogue.locale !== identity.locale) {
        return yield* Effect.fail(
          new PreparationDataError({
            message: `Active facts locale ${factsCatalogue.locale} did not match requested locale ${identity.locale}.`,
            operation: 'load-preparation-context',
          })
        )
      }
      const jobContext = yield* decodeOpaqueValue(
        'decode-job-context',
        jobPayload
      )

      return {
        factsCatalogue,
        factsRelease: loaded.factsRelease,
        factsReleaseId: loaded.factsRelease.release.id,
        jobContext,
        jobSnapshot,
        locale: identity.locale,
      }
    },
    (effect) => effect.pipe(dataError('load-preparation-context'))
  )

  const loadBootstrap = Effect.fn('PreparationRepository.loadBootstrap')(
    function* (identity: PreparationIdentity) {
      const application = yield* startApplicationPreparation(
        registry,
        identity.applicationId
      ).pipe(dataError('start-application-preparation'))
      const loaded = yield* Effect.all(
        {
          context: loadContext(identity),
          entry: registry.registry.ensureContentEntry({
            params: { id: identity.applicationId },
            payload: { kind: identity.kind, locale: identity.locale },
          }),
        },
        { concurrency: 2 }
      )
      const head = yield* loadContentHead({
        applicationId: identity.applicationId,
        entryId: loaded.entry.id,
        revisionId: loaded.entry.headRevisionId,
      })
      return {
        application,
        context: loaded.context,
        entry: head?.entry ?? loaded.entry,
        head,
      }
    },
    (effect) => effect.pipe(dataError('load-preparation-bootstrap'))
  )

  const discoverModels = Effect.fn('PreparationRepository.discoverModels')(() =>
    ai.discoverModels().pipe(dataError('discover-models'))
  )

  const refreshSnapshot = Effect.fn('PreparationRepository.refreshSnapshot')(
    (applicationId: string) =>
      registry.registry
        .captureJobPostingSnapshot({ params: { id: applicationId } })
        .pipe(dataError('refresh-job-snapshot'))
  )

  const persistManualJobContext = Effect.fn(
    'PreparationRepository.persistManualJobContext'
  )(
    function* ({ applicationId, value }: ManualJobContextInput) {
      const normalized = value.trim()
      if (normalized.length === 0) {
        return yield* Effect.fail(
          new PreparationDataError({
            message: 'Job context cannot be empty.',
            operation: 'persist-manual-job-context',
          })
        )
      }
      if (
        new TextEncoder().encode(normalized).byteLength >
        manualJobContextMaxBytes
      ) {
        return yield* Effect.fail(
          new PreparationDataError({
            message: `Job context must not exceed ${manualJobContextMaxBytes} UTF-8 bytes.`,
            operation: 'persist-manual-job-context',
          })
        )
      }

      const loaded = yield* Effect.all(
        {
          application: registry.registry.getApplication({
            params: { id: applicationId },
          }),
          latest: latestSnapshotOrNull(applicationId),
        },
        { concurrency: 2 }
      )
      const data = yield* encodeOpaqueText(
        'encode-manual-job-context',
        normalized
      )
      return yield* registry.registry
        .persistJobPostingSnapshot({
          params: { id: applicationId },
          payload: {
            fetcherVersion: manualJobContextFetcherVersion,
            finalUrl:
              loaded.latest?.finalUrl ?? loaded.application.canonicalUrl,
            normalized: {
              data,
              mediaType: 'text/plain; charset=utf-8',
            },
            requestedUrl:
              loaded.latest?.requestedUrl ?? loaded.application.canonicalUrl,
            status: 'provided',
          },
        })
        .pipe(dataError('persist-manual-job-context'))
    },
    (effect) => effect.pipe(dataError('persist-manual-job-context'))
  )

  return {
    discoverModels,
    loadBootstrap,
    loadContext,
    persistManualJobContext,
    refreshSnapshot,
  }
}
