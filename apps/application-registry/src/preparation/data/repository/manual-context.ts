import type { JobPostingSnapshot } from '@cv/application-registry-entity'
import { type Crypto, Effect } from 'effect'

import type { RegistryClient } from '@/lib/registry-client'
import type { ManualJobContextInput } from '../types'
import { PreparationDataError } from '../types'
import { dataError, encodeOpaqueText, sha256Hex } from './shared'

export const manualJobContextMaxBytes = 256 * 1_024
export const manualJobContextFetcherVersion =
  'application-registry-management-job-context/v1'

export const makeManualJobContextRepository = (
  registry: RegistryClient['Service'],
  crypto: Crypto.Crypto
) => {
  const latestSnapshotOrNull = (applicationId: string) =>
    registry.content
      .getLatestJobPostingSnapshot({ params: { id: applicationId } })
      .pipe(
        Effect.map((snapshot): JobPostingSnapshot | null => snapshot),
        Effect.catchTag('NotFoundError', () =>
          Effect.succeed<JobPostingSnapshot | null>(null)
        )
      )

  const refreshSnapshot = Effect.fn('PreparationRepository.refreshSnapshot')(
    (applicationId: string) =>
      registry.content
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
          application: registry.applications.getApplication({
            params: { id: applicationId },
          }),
          latest: latestSnapshotOrNull(applicationId),
        },
        { concurrency: 2 }
      )
      const data = encodeOpaqueText(normalized)
      const sha256 = yield* sha256Hex(crypto, data).pipe(
        dataError('hash-manual-job-context')
      )
      yield* registry.content
        .putBlob({ params: { sha256 }, payload: data })
        .pipe(dataError('upload-manual-job-context'))
      return yield* registry.content
        .persistJobPostingSnapshot({
          params: { id: applicationId },
          payload: {
            fetcherVersion: manualJobContextFetcherVersion,
            finalUrl: loaded.latest?.finalUrl ?? loaded.application.postingUrl,
            normalized: {
              mediaType: 'text/plain; charset=utf-8',
              sha256,
            },
            requestedUrl:
              loaded.latest?.requestedUrl ?? loaded.application.postingUrl,
            status: 'provided',
          },
        })
        .pipe(dataError('persist-manual-job-context'))
    },
    (effect) => effect.pipe(dataError('persist-manual-job-context'))
  )

  return { persistManualJobContext, refreshSnapshot }
}
