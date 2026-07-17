import { describe, expect, test } from 'bun:test'

import { operationSubmissionFor } from './operation-submission'

describe('operationSubmissionFor', () => {
  test('reuses an operation id only while the normalized payload is unchanged', () => {
    const first = operationSubmissionFor(undefined, {
      expectedVersion: 4,
      company: 'Example',
    })
    const retry = operationSubmissionFor(first, {
      expectedVersion: 4,
      company: 'Example',
    })
    const edited = operationSubmissionFor(retry, {
      expectedVersion: 4,
      company: 'Updated example',
    })

    expect(retry.operationId).toBe(first.operationId)
    expect(edited.operationId).not.toBe(first.operationId)
  })

  test('allocates a new operation id for a refreshed version snapshot', () => {
    const stale = operationSubmissionFor(undefined, {
      expectedVersion: 4,
      resolution: 'open',
    })
    const refreshed = operationSubmissionFor(stale, {
      expectedVersion: 5,
      resolution: 'open',
    })

    expect(refreshed.operationId).not.toBe(stale.operationId)
  })
})
