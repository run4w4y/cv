import { describe, expect, test } from 'bun:test'
import { campaignExitCode } from './command'

describe('application campaign CLI exit status', () => {
  test('fails the process for partial and failed multi-target runs', () => {
    expect(campaignExitCode('succeeded')).toBe(0)
    expect(campaignExitCode('partial')).toBe(1)
    expect(campaignExitCode('failed')).toBe(1)
  })
})
