import type { ContentRevisionResult, PreparationRun } from './domain'

/**
 * Prevents a newer, unrelated head revision from being approved while this
 * browser runtime is presenting a workflow candidate for human review.
 *
 * This is only a synchronous UI hint because one revision cannot prove its
 * complete ancestry. Submission performs an authoritative registry preflight
 * before claiming the review token, and the Workflow verifies it again before
 * approval.
 */
export const isRevisionBoundToPreparationRun = (
  run: PreparationRun,
  result: ContentRevisionResult
): boolean => {
  const candidate = run.candidate?.result
  if (candidate === undefined) return false

  const expected = candidate.revision
  const selected = result.revision
  if (
    result.entry.id !== candidate.entry.id ||
    selected.contentEntryId !== expected.contentEntryId ||
    selected.contractId !== expected.contractId ||
    selected.contractVersion !== expected.contractVersion ||
    selected.factsReleaseId !== expected.factsReleaseId ||
    selected.jobSnapshotId !== expected.jobSnapshotId
  ) {
    return false
  }

  return selected.id === expected.id || selected.source === 'human'
}
