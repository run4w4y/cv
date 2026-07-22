import type { AppendContentRevisionRequest } from '@cv/application-registry-api-contract'
import type {
  ContentEntry,
  ContentRevisionSource,
} from '@cv/application-registry-entity'

export type BuildAppendRevisionRequestInput = {
  readonly blob: AppendContentRevisionRequest['blob']
  readonly contractId: string
  readonly contractVersion: string
  readonly entry: ContentEntry
  readonly factsReleaseId: string | null
  readonly jobSnapshotId: string | null
  readonly source: ContentRevisionSource
}

/** Pure construction of the opaque, provenance-pinned registry request. */
export const buildAppendRevisionRequest = (
  input: BuildAppendRevisionRequestInput
): AppendContentRevisionRequest => ({
  contractId: input.contractId,
  contractVersion: input.contractVersion,
  expectedVersion: input.entry.version,
  factsReleaseId: input.factsReleaseId,
  jobSnapshotId: input.jobSnapshotId,
  blob: input.blob,
  source: input.source,
})
