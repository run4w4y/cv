import { describe, expect, test } from 'bun:test'
import type { ContentEntry } from '@cv/application-registry-entity'

import { buildAppendRevisionRequest } from './revision-request'

const entry: ContentEntry = {
  applicationId: 'application-1',
  approvedRevisionId: null,
  createdAt: '2026-07-17T00:00:00.000Z',
  headRevisionId: null,
  id: 'entry-1',
  kind: 'cv',
  locale: 'en',
  state: 'draft',
  updatedAt: '2026-07-17T00:00:00.000Z',
  version: 7,
}

describe('revision request construction', () => {
  test('pins a previously uploaded blob, provenance, and concurrency fields', () => {
    const request = buildAppendRevisionRequest({
      blob: { mediaType: 'application/json', sha256: 'abc123' },
      contractId: 'dynamic.contract',
      contractVersion: '99',
      entry,
      factsReleaseId: 'facts-release-1',
      jobSnapshotId: 'job-snapshot-1',
      source: 'human',
    })

    expect(request.expectedVersion).toBe(7)
    expect(request.factsReleaseId).toBe('facts-release-1')
    expect(request.jobSnapshotId).toBe('job-snapshot-1')
    expect(request.blob).toEqual({
      mediaType: 'application/json',
      sha256: 'abc123',
    })
  })
})
