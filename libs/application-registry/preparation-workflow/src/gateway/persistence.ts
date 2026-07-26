import {
  CvDocumentV1Schema,
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import { Effect, Schema } from 'effect'

import {
  CoverLetterDocumentSchema,
  coverLetterContractId,
  coverLetterContractVersion,
} from '../cover-letter/contract'

import type {
  ContentRevisionResult,
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
import { validateCvProvenance } from './validation/provenance'

const retryRepositoryOperation = { times: 2 } as const

const revisionMetadataMatches = (
  expected: ContentRevisionResult['revision'],
  actual: ContentRevisionResult['revision']
): boolean =>
  actual.id === expected.id &&
  hasCandidatePins(expected, actual) &&
  actual.byteLength === expected.byteLength &&
  actual.createdAt === expected.createdAt &&
  actual.mediaType === expected.mediaType &&
  actual.objectKey === expected.objectKey &&
  actual.operationId === expected.operationId &&
  actual.parentRevisionId === expected.parentRevisionId &&
  actual.revisionNumber === expected.revisionNumber &&
  actual.sha256 === expected.sha256 &&
  actual.source === expected.source

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
      if (
        selected.revision.factsReleaseId === null ||
        selected.revision.jobSnapshotId === null
      ) {
        return yield* Effect.fail(
          reviewBindingError(
            'The selected revision is missing the immutable facts or job-snapshot provenance required for approval.'
          )
        )
      }

      const authoritative = yield* Effect.all(
        {
          bootstrap: repository
            .loadWorkflowBootstrap({
              application: candidate.application,
              kind: loaded.entry.kind,
              locale: loaded.entry.locale,
              snapshotId: selected.revision.jobSnapshotId,
            })
            .pipe(Effect.retry(retryRepositoryOperation), stageError('review')),
          revision: repository
            .loadContentRevision({
              applicationId: candidate.application.id,
              entryId: loaded.entry.id,
              revisionId: selected.revision.id,
            })
            .pipe(Effect.retry(retryRepositoryOperation), stageError('review')),
        },
        { concurrency: 2 }
      )

      const entryIdentityMatches = (entry: typeof loaded.entry): boolean =>
        entry.id === loaded.entry.id &&
        entry.applicationId === candidate.application.id &&
        entry.kind === loaded.entry.kind &&
        entry.locale === loaded.entry.locale &&
        entry.headRevisionId === selected.revision.id

      if (
        !entryIdentityMatches(authoritative.bootstrap.entry) ||
        !entryIdentityMatches(authoritative.revision.entry) ||
        !revisionMetadataMatches(
          selected.revision,
          authoritative.revision.revision
        )
      ) {
        return yield* Effect.fail(
          reviewBindingError(
            'The exact stored revision value no longer matches the selected workflow revision metadata.'
          )
        )
      }
      if (
        authoritative.bootstrap.context.factsReleaseId !==
          selected.revision.factsReleaseId ||
        authoritative.bootstrap.context.jobSnapshot.id !==
          selected.revision.jobSnapshotId
      ) {
        return yield* Effect.fail(
          reviewBindingError(
            'The selected revision provenance no longer matches the authoritative reviewed facts and job snapshot.'
          )
        )
      }

      if (loaded.entry.kind === 'cv') {
        if (candidate.candidate._tag !== 'Cv') {
          return yield* Effect.fail(
            reviewBindingError(
              'The selected CV revision does not belong to a CV workflow candidate.'
            )
          )
        }
        const document = yield* Schema.decodeUnknownEffect(CvDocumentV1Schema)(
          authoritative.revision.value
        )
        if (document.locale !== loaded.entry.locale) {
          return yield* Effect.fail(
            reviewBindingError(
              'The selected CV revision locale does not match its content entry.'
            )
          )
        }
        yield* validateCvProvenance(
          authoritative.bootstrap.context.factsCatalogue,
          document
        )
      } else {
        if (candidate.candidate._tag !== 'CoverLetter') {
          return yield* Effect.fail(
            reviewBindingError(
              'The selected cover-letter revision does not belong to a cover-letter workflow candidate.'
            )
          )
        }
        const document = yield* Schema.decodeUnknownEffect(
          CoverLetterDocumentSchema
        )(authoritative.revision.value)
        if (
          document.locale !== loaded.entry.locale ||
          document.referenceCvRevisionId !==
            candidate.candidate.document.referenceCvRevisionId
        ) {
          return yield* Effect.fail(
            reviewBindingError(
              'The selected cover-letter revision changed its locale or immutable accepted-CV reference.'
            )
          )
        }
      }

      return {
        entry: authoritative.bootstrap.entry,
        revisions: loaded.revisions,
        selected: {
          entry: authoritative.bootstrap.entry,
          revision: selected.revision,
        },
      }
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
