import type { ContentRevisionResultResponse } from '@cv/application-registry-api-contract'
import type {
  ContentEntry,
  ContentRevision,
} from '@cv/application-registry-entity'
import { Effect } from 'effect'

import type { SavedCandidate } from '../domain'
import { PreparationWorkflowError } from '../domain'

const maximumHumanReviewDepth = 32

export const reviewBindingError = (message: string) =>
  new PreparationWorkflowError({ message, stage: 'review' })

export const hasCandidatePins = (
  candidate: ContentRevision,
  revision: ContentRevision
): boolean =>
  revision.contentEntryId === candidate.contentEntryId &&
  revision.contractId === candidate.contractId &&
  revision.contractVersion === candidate.contractVersion &&
  revision.factsReleaseId === candidate.factsReleaseId &&
  revision.jobSnapshotId === candidate.jobSnapshotId

/**
 * Verifies a selected head against a fresh registry entry and its immutable
 * revision metadata. A reviewer may select the generated candidate itself or
 * a short chain of human edits descended directly from that candidate.
 */
export const verifyRevisionSelectionBinding = (
  candidate: SavedCandidate,
  selectedRevisionId: string,
  entry: ContentEntry,
  revisions: ReadonlyArray<ContentRevision>
): Effect.Effect<ContentRevisionResultResponse, PreparationWorkflowError> =>
  Effect.gen(function* () {
    const candidateEntry = candidate.result.entry
    const candidateRevision = candidate.result.revision

    if (
      candidate.application.id !== candidateEntry.applicationId ||
      entry.id !== candidateEntry.id ||
      entry.applicationId !== candidate.application.id ||
      entry.kind !== candidateEntry.kind ||
      entry.locale !== candidateEntry.locale
    ) {
      return yield* Effect.fail(
        reviewBindingError(
          'The approved content entry does not belong to this workflow candidate.'
        )
      )
    }
    if (entry.headRevisionId !== selectedRevisionId) {
      return yield* Effect.fail(
        reviewBindingError(
          'The selected revision is not the current head of the candidate entry.'
        )
      )
    }

    const revisionsById = new Map<string, ContentRevision>()
    for (const revision of revisions) {
      if (revisionsById.has(revision.id)) {
        return yield* Effect.fail(
          reviewBindingError(
            `The registry returned duplicate revision metadata for ${revision.id}.`
          )
        )
      }
      revisionsById.set(revision.id, revision)
    }

    const storedCandidate = revisionsById.get(candidateRevision.id)
    if (
      storedCandidate === undefined ||
      !hasCandidatePins(candidateRevision, storedCandidate) ||
      storedCandidate.operationId !== candidateRevision.operationId ||
      storedCandidate.parentRevisionId !== candidateRevision.parentRevisionId ||
      storedCandidate.revisionNumber !== candidateRevision.revisionNumber ||
      storedCandidate.source !== candidateRevision.source
    ) {
      return yield* Effect.fail(
        reviewBindingError(
          'The generated workflow candidate no longer matches registry revision metadata.'
        )
      )
    }

    const selected = revisionsById.get(selectedRevisionId)
    if (selected === undefined) {
      return yield* Effect.fail(
        reviewBindingError(
          `The selected revision ${selectedRevisionId} was not found on the candidate entry.`
        )
      )
    }

    const visited = new Set<string>()
    let current = selected
    for (let depth = 0; depth <= maximumHumanReviewDepth; depth += 1) {
      if (visited.has(current.id)) {
        return yield* Effect.fail(
          reviewBindingError('The approved revision ancestry contains a cycle.')
        )
      }
      visited.add(current.id)

      if (!hasCandidatePins(candidateRevision, current)) {
        return yield* Effect.fail(
          reviewBindingError(
            `Revision ${current.id} changed the workflow candidate contract or provenance pins.`
          )
        )
      }
      if (current.id === candidateRevision.id) {
        return { entry, revision: selected }
      }
      if (current.source !== 'human') {
        return yield* Effect.fail(
          reviewBindingError(
            `Revision ${current.id} is not a human edit of the workflow candidate.`
          )
        )
      }
      if (depth === maximumHumanReviewDepth) {
        return yield* Effect.fail(
          reviewBindingError(
            `The approved revision is more than ${maximumHumanReviewDepth} human edits from the workflow candidate.`
          )
        )
      }
      if (current.parentRevisionId === null) {
        return yield* Effect.fail(
          reviewBindingError(
            `Revision ${current.id} does not descend from the workflow candidate.`
          )
        )
      }
      const parent = revisionsById.get(current.parentRevisionId)
      if (parent === undefined) {
        return yield* Effect.fail(
          reviewBindingError(
            `Revision ${current.id} has missing parent ${current.parentRevisionId}.`
          )
        )
      }
      if (parent.revisionNumber + 1 !== current.revisionNumber) {
        return yield* Effect.fail(
          reviewBindingError(
            `Revision ${current.id} has inconsistent ancestry metadata.`
          )
        )
      }
      current = parent
    }

    return yield* Effect.fail(
      reviewBindingError(
        `The approved revision is more than ${maximumHumanReviewDepth} human edits from the workflow candidate.`
      )
    )
  })

export const verifyApprovedRevisionBinding = (
  candidate: SavedCandidate,
  approvedRevisionId: string,
  entry: ContentEntry,
  revisions: ReadonlyArray<ContentRevision>
): Effect.Effect<ContentRevisionResultResponse, PreparationWorkflowError> =>
  Effect.gen(function* () {
    const selected = yield* verifyRevisionSelectionBinding(
      candidate,
      approvedRevisionId,
      entry,
      revisions
    )
    if (
      entry.state !== 'approved' ||
      entry.approvedRevisionId !== approvedRevisionId
    ) {
      return yield* Effect.fail(
        reviewBindingError(
          'The selected revision is not the currently approved head of the candidate entry.'
        )
      )
    }
    return selected
  })
