import { type Crypto, Effect } from 'effect'

import type { RegistryClient } from '../../../lib/registry-client'
import type { ContentHeadIdentity, PreparationIdentity } from '../keys'
import { buildAppendRevisionRequest } from '../revision-request'
import type {
  AppendRevisionInput,
  ApproveRevisionInput,
  SavedContentRevision,
} from '../types'
import { asPreparationDataError, dataError, decodeOpaqueValue } from './shared'

export const makePreparationContentRepository = (
  registry: RegistryClient['Service'],
  crypto: Crypto.Crypto
) => {
  const loadContentHead = Effect.fn('PreparationRepository.loadContentHead')(
    function* (identity: ContentHeadIdentity) {
      if (identity.revisionId === null) return null
      const loaded = yield* registry.registry.readContentRevision({
        params: {
          entryId: identity.entryId,
          id: identity.applicationId,
          revisionId: identity.revisionId,
        },
      })
      const value = yield* decodeOpaqueValue(
        'decode-content-revision',
        loaded.payload
      )
      return {
        entry: loaded.entry,
        revision: loaded.revision,
        value,
      } satisfies SavedContentRevision
    },
    (effect) => effect.pipe(dataError('load-content-head'))
  )

  const loadPreparationHead = Effect.fn(
    'PreparationRepository.loadPreparationHead'
  )(
    function* (identity: PreparationIdentity) {
      const entry = yield* registry.registry.ensureContentEntry({
        params: { id: identity.applicationId },
        payload: { kind: identity.kind, locale: identity.locale },
      })
      return yield* loadContentHead({
        applicationId: identity.applicationId,
        entryId: entry.id,
        revisionId: entry.headRevisionId,
      })
    },
    (effect) => effect.pipe(dataError('load-preparation-head'))
  )

  const appendRevision = Effect.fn('PreparationRepository.appendRevision')(
    function* (input: AppendRevisionInput) {
      const operationId = input.operationId ?? (yield* crypto.randomUUIDv4)
      const request = yield* Effect.try({
        try: () => buildAppendRevisionRequest({ ...input, operationId }),
        catch: (cause) =>
          asPreparationDataError('encode-content-revision', cause),
      })
      return yield* registry.registry.appendContentRevision({
        params: {
          entryId: input.entry.id,
          id: input.applicationId,
        },
        payload: request,
      })
    },
    (effect) => effect.pipe(dataError('append-content-revision'))
  )

  const approveRevision = Effect.fn('PreparationRepository.approveRevision')(
    (input: ApproveRevisionInput) =>
      registry.registry
        .approveContentRevision({
          params: {
            entryId: input.entry.id,
            id: input.applicationId,
          },
          payload: {
            expectedVersion: input.entry.version,
            revisionId: input.revisionId,
          },
        })
        .pipe(dataError('approve-content-revision'))
  )

  return {
    appendRevision,
    approveRevision,
    loadContentHead,
    loadPreparationHead,
  }
}
