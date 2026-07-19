import type { ContentRevisionResultResponse } from '@cv/application-registry-api-contract'
import {
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import { Effect } from 'effect'
import * as HttpClientError from 'effect/unstable/http/HttpClientError'

import type { RegistryClient } from '../../../lib/registry-client'
import { encodeJsonBase64 } from '../../base64'
import {
  coverLetterContractId,
  coverLetterContractVersion,
} from '../../cover-letter-contract'
import type {
  GeneratedCandidate,
  PreparationBootstrap,
  PreparationWorkflowInput,
  SavedCandidate,
} from '../domain'
import {
  hasCandidatePins,
  reviewBindingError,
  verifyApprovedRevisionBinding,
  verifyRevisionSelectionBinding,
} from './review-binding'
import { stageError } from './shared'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const shouldRetryCandidateSave = (error: unknown): boolean => {
  if (isRecord(error)) {
    if (
      error._tag === 'ConflictError' ||
      error._tag === 'InternalServerError'
    ) {
      return true
    }
  }
  if (!HttpClientError.isHttpClientError(error)) return false

  switch (error.reason._tag) {
    case 'TransportError':
    case 'DecodeError':
    case 'EmptyBodyError':
      return true
    case 'StatusCodeError':
      return (
        error.reason.response.status === 408 ||
        error.reason.response.status === 429 ||
        error.reason.response.status >= 500
      )
    case 'EncodeError':
    case 'InvalidUrlError':
      return false
  }
}

export const makePreparationPersistenceGateway = (
  registry: RegistryClient['Service']
) => {
  const loadBoundRevision = Effect.fn('PreparationGateway.loadBoundRevision')(
    function* (candidate: SavedCandidate, selectedRevisionId: string) {
      const params = {
        entryId: candidate.result.entry.id,
        id: candidate.application.id,
      }
      const revisions = yield* registry.registry.listContentRevisions({
        params,
      })
      // Read the mutable entry after immutable revision metadata so callers
      // validate against the freshest authoritative head.
      const entry = yield* registry.registry.getContentEntry({ params })
      const selected = yield* verifyRevisionSelectionBinding(
        candidate,
        selectedRevisionId,
        entry,
        revisions.items
      )
      return { entry, params, revisions: revisions.items, selected }
    }
  )

  const verifyBoundRevision = Effect.fn(
    'PreparationGateway.verifyBoundRevision'
  )((candidate: SavedCandidate, selectedRevisionId: string) =>
    loadBoundRevision(candidate, selectedRevisionId).pipe(
      Effect.map(({ selected }) => selected),
      Effect.retry({
        times: 2,
        while: shouldRetryCandidateSave,
      }),
      stageError('review')
    )
  )

  const saveCandidate = Effect.fn('PreparationGateway.saveCandidate')(
    function* (
      input: PreparationWorkflowInput,
      context: PreparationBootstrap,
      candidate: GeneratedCandidate
    ) {
      const contract =
        input.kind === 'cv'
          ? {
              id: cvDocumentV1ContractId,
              version: String(cvDocumentV1Version),
            }
          : {
              id: coverLetterContractId,
              version: coverLetterContractVersion,
            }
      const result: ContentRevisionResultResponse = yield* Effect.gen(
        function* () {
          const currentEntry = yield* registry.registry.getContentEntry({
            params: {
              entryId: context.entry.id,
              id: context.application.id,
            },
          })
          return yield* registry.registry.appendContentRevision({
            params: {
              entryId: currentEntry.id,
              id: context.application.id,
            },
            payload: {
              contractId: contract.id,
              contractVersion: contract.version,
              expectedVersion: currentEntry.version,
              factsReleaseId: context.factsReleaseId,
              jobSnapshotId: context.jobSnapshot.id,
              operationId: `${input.runId}:candidate`,
              payload: {
                data: encodeJsonBase64(candidate.document),
                mediaType: 'application/json',
              },
              source: 'ai',
            },
          })
        }
      ).pipe(
        Effect.retry({
          times: 2,
          while: shouldRetryCandidateSave,
        }),
        stageError('saving')
      )
      return {
        application: context.application,
        candidate,
        result,
      }
    }
  )

  const approveBoundRevision = Effect.fn(
    'PreparationGateway.approveBoundRevision'
  )((candidate: SavedCandidate, selectedRevisionId: string) => {
    return Effect.gen(function* () {
      const bound = yield* loadBoundRevision(candidate, selectedRevisionId)
      const { entry, params, revisions } = bound

      // This also makes a retry safe if the first approval committed but its
      // HTTP response was lost.
      if (
        entry.state === 'approved' &&
        entry.approvedRevisionId === selectedRevisionId
      ) {
        return yield* verifyApprovedRevisionBinding(
          candidate,
          selectedRevisionId,
          entry,
          revisions
        )
      }

      const approved = yield* registry.registry.approveContentRevision({
        params,
        payload: {
          expectedVersion: entry.version,
          revisionId: selectedRevisionId,
        },
      })
      const verified = yield* verifyApprovedRevisionBinding(
        candidate,
        selectedRevisionId,
        approved.entry,
        revisions
      )
      if (
        approved.revision.id !== verified.revision.id ||
        !hasCandidatePins(verified.revision, approved.revision)
      ) {
        return yield* Effect.fail(
          reviewBindingError(
            'The registry approval response did not match the selected workflow revision.'
          )
        )
      }
      return approved
    }).pipe(
      Effect.retry({
        times: 2,
        while: shouldRetryCandidateSave,
      }),
      stageError('review')
    )
  })

  return {
    approveBoundRevision,
    saveCandidate,
    verifyBoundRevision,
  }
}
