import { describe, expect, test } from 'bun:test'
import { campaignRunStatus } from './run'

describe('campaign run status', () => {
  test('summarizes target results', () => {
    expect(campaignRunStatus(['succeeded', 'succeeded'])).toBe('succeeded')
    expect(campaignRunStatus(['failed', 'failed'])).toBe('failed')
    expect(campaignRunStatus(['succeeded', 'partial'])).toBe('partial')
    expect(campaignRunStatus(['succeeded', 'failed'])).toBe('partial')
  })
})
