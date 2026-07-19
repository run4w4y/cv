import { describe, expect, test } from 'bun:test'
import type { ContentEntry } from '@cv/application-registry-entity'

import { decodeJsonBase64 } from '../base64'
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
  test('serializes opaque JSON and pins provenance and concurrency fields', () => {
    const value = { noKnownFieldsRequired: ['a', 2, false] }
    const request = buildAppendRevisionRequest({
      contractId: 'dynamic.contract',
      contractVersion: '99',
      entry,
      factsReleaseId: 'facts-release-1',
      jobSnapshotId: 'job-snapshot-1',
      operationId: 'operation-1',
      source: 'human',
      value,
    })

    expect(request.expectedVersion).toBe(7)
    expect(request.factsReleaseId).toBe('facts-release-1')
    expect(request.jobSnapshotId).toBe('job-snapshot-1')
    expect(request.operationId).toBe('operation-1')
    expect(request.payload.mediaType).toBe('application/json')
    expect(decodeJsonBase64(request.payload.data)).toEqual(value)
  })
})
