import { describe, expect, test } from 'bun:test'

import { newAiWorkflowPostingTargetHref } from './batch-screen'

describe('AI workflow retry target', () => {
  test('prefills the canonical PostingUrl query contract', () => {
    expect(
      newAiWorkflowPostingTargetHref(
        'https://jobs.example.test/staff engineer?source=board',
        'en-US'
      )
    ).toBe(
      '/ai-workflows/new?postingUrl=https%3A%2F%2Fjobs.example.test%2Fstaff%20engineer%3Fsource%3Dboard&locale=en-US'
    )
  })
})
