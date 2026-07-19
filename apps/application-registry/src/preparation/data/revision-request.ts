import type { AppendContentRevisionRequest } from '@cv/application-registry-api-contract'
import type {
  ContentEntry,
  ContentRevisionSource,
} from '@cv/application-registry-entity'

import { encodeJsonBase64 } from '../base64'

export type BuildAppendRevisionRequestInput = {
  readonly contractId: string
  readonly contractVersion: string
  readonly entry: ContentEntry
  readonly factsReleaseId: string | null
  readonly jobSnapshotId: string | null
  readonly operationId: string
  readonly source: ContentRevisionSource
  readonly value: unknown
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
  operationId: input.operationId,
  payload: {
    data: encodeJsonBase64(input.value),
    mediaType: 'application/json',
  },
  source: input.source,
})
