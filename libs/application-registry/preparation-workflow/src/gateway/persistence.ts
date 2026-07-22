import {
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import { Effect } from 'effect'

import {
  coverLetterContractId,
  coverLetterContractVersion,
} from '../cover-letter/contract'

import type {
  GeneratedCandidate,
  PreparationBootstrap,
  PreparationWorkflowInput,
  SavedCandidate,
} from '../domain'
import type { PreparationStoreShape } from '../store'
import {
  hasCandidatePins,
  reviewBindingError,
  verifyApprovedRevisionBinding,
  verifyRevisionSelectionBinding,
} from './review-binding'
import { stageError } from './shared'

const retryRepositoryOperation = { times: 2 } as const

export const makePreparationPersistenceGateway = (
  repository: PreparationStoreShape
) => {
  const loadBoundRevision = Effect.fn('PreparationGateway.loadBoundRevision')(
    function* (candidate: SavedCandidate, selectedRevisionId: string) {
      const loaded = yield* repository
        .loadContentRevisionHistory({
          applicationId: candidate.application.id,
          entryId: candidate.result.entry.id,
        })
        .pipe(Effect.retry(retryRepositoryOperation), stageError('review'))
      const selected = yield* verifyRevisionSelectionBinding(
        candidate,
        selectedRevisionId,
        loaded.entry,
        loaded.revisions
      )
      return { ...loaded, selected }
    }
  )

  const verifyBoundRevision = Effect.fn(
    'PreparationGateway.verifyBoundRevision'
  )((candidate: SavedCandidate, selectedRevisionId: string) =>
    loadBoundRevision(candidate, selectedRevisionId).pipe(
      Effect.map(({ selected }) => selected),
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
      const currentEntry = yield* repository
        .loadContentEntry({
          applicationId: context.application.id,
          entryId: context.entry.id,
        })
        .pipe(stageError('saving'))
      const result = yield* repository
        .appendRevision({
          applicationId: context.application.id,
          contractId: contract.id,
          contractVersion: contract.version,
          entry: currentEntry,
          factsReleaseId: context.factsReleaseId,
          jobSnapshotId: context.jobSnapshot.id,
          operationId: `${input.runId}:candidate`,
          source: 'ai',
          value: candidate.document,
        })
        .pipe(Effect.retry(retryRepositoryOperation), stageError('saving'))
      return {
        application: context.application,
        candidate,
        result,
      }
    }
  )

  const approveBoundRevision = Effect.fn(
    'PreparationGateway.approveBoundRevision'
  )((candidate: SavedCandidate, selectedRevisionId: string) =>
    Effect.gen(function* () {
      const bound = yield* loadBoundRevision(candidate, selectedRevisionId)
      const { entry, revisions } = bound

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

      const approved = yield* repository
        .approveRevision({
          applicationId: candidate.application.id,
          entry,
          revisionId: selectedRevisionId,
        })
        .pipe(Effect.retry(retryRepositoryOperation))
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
    }).pipe(stageError('review'))
  )

  return {
    approveBoundRevision,
    saveCandidate,
    verifyBoundRevision,
  }
}
