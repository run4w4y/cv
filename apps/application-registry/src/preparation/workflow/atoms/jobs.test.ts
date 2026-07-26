import { describe, expect, test } from 'bun:test'

import { cancelAiWorkflowJobFamily } from './jobs'

describe('preparation job command atoms', () => {
  test('isolates cancellation state by job id', () => {
    expect(cancelAiWorkflowJobFamily('job-1')).toBe(
      cancelAiWorkflowJobFamily('job-1')
    )
    expect(cancelAiWorkflowJobFamily('job-1')).not.toBe(
      cancelAiWorkflowJobFamily('job-2')
    )
  })
})
