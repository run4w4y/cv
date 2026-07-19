import { type Crypto, Effect } from 'effect'

import type { RegistryClient } from '@/lib/registry-client'
import type { ContentHeadIdentity, PreparationIdentity } from '../keys'
import { buildAppendRevisionRequest } from '../revision-request'
import type {
  AppendRevisionInput,
  ApproveRevisionInput,
  ContentRevisionHistoryInput,
  SavedContentRevision,
} from '../types'
import {
  asPreparationDataError,
  dataError,
  decodeOpaqueValue,
  encodeOpaqueJson,
  sha256Hex,
} from './shared'

export const makePreparationContentRepository = (
  registry: RegistryClient['Service'],
  crypto: Crypto.Crypto
) => {
  const loadContentHead = Effect.fn('PreparationRepository.loadContentHead')(
    function* (identity: ContentHeadIdentity) {
      if (identity.revisionId === null) return null
      const loaded = yield* registry.content.readContentRevision({
        params: {
          entryId: identity.entryId,
          id: identity.applicationId,
          revisionId: identity.revisionId,
        },
      })
      const payload = yield* registry.content.readContentRevisionPayload({
        params: {
          entryId: identity.entryId,
          id: identity.applicationId,
          revisionId: identity.revisionId,
        },
      })
      const value = yield* decodeOpaqueValue(
        'decode-content-revision',
        payload,
        loaded.revision.mediaType
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
      const entry = yield* registry.content.ensureContentEntry({
        params: {
          id: identity.applicationId,
          kind: identity.kind,
          locale: identity.locale,
        },
      })
      return yield* loadContentHead({
        applicationId: identity.applicationId,
        entryId: entry.id,
        revisionId: entry.headRevisionId,
      })
    },
    (effect) => effect.pipe(dataError('load-preparation-head'))
  )

  const loadContentEntry = Effect.fn('PreparationRepository.loadContentEntry')(
    (input: ContentRevisionHistoryInput) =>
      registry.content
        .getContentEntry({
          params: {
            entryId: input.entryId,
            id: input.applicationId,
          },
        })
        .pipe(dataError('load-content-entry'))
  )

  const loadContentRevisionHistory = Effect.fn(
    'PreparationRepository.loadContentRevisionHistory'
  )(
    function* (input: ContentRevisionHistoryInput) {
      const params = {
        entryId: input.entryId,
        id: input.applicationId,
      }
      const revisions = yield* registry.content.listContentRevisions({ params })
      const entry = yield* registry.content.getContentEntry({ params })
      return { entry, revisions: revisions.items }
    },
    (effect) => effect.pipe(dataError('load-content-revision-history'))
  )

  const appendRevision = Effect.fn('PreparationRepository.appendRevision')(
    function* (input: AppendRevisionInput) {
      const operationId = input.operationId ?? (yield* crypto.randomUUIDv4)
      const bytes = yield* Effect.try({
        try: () => encodeOpaqueJson(input.value),
        catch: (cause) =>
          asPreparationDataError('encode-content-revision', cause),
      })
      const sha256 = yield* sha256Hex(crypto, bytes).pipe(
        Effect.mapError((cause) =>
          asPreparationDataError('hash-content-revision', cause)
        )
      )
      yield* registry.content.putBlob({
        params: { sha256 },
        payload: bytes,
      })
      const request = yield* Effect.try({
        try: () =>
          buildAppendRevisionRequest({
            ...input,
            blob: { mediaType: 'application/json', sha256 },
          }),
        catch: (cause) =>
          asPreparationDataError('encode-content-revision', cause),
      })
      return yield* registry.content.appendContentRevision({
        headers: { 'idempotency-key': operationId },
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
      registry.content
        .approveContentRevision({
          params: {
            entryId: input.entry.id,
            id: input.applicationId,
          },
          payload: {
            expectedVersion: input.entry.version,
            approvedRevisionId: input.revisionId,
          },
        })
        .pipe(dataError('approve-content-revision'))
  )

  return {
    appendRevision,
    approveRevision,
    loadContentEntry,
    loadContentHead,
    loadContentRevisionHistory,
    loadPreparationHead,
  }
}
