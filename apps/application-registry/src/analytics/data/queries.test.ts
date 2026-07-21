import { describe, expect, test } from 'bun:test'

import {
  cvAnalyticsCustomRangeKey,
  cvAnalyticsPresetRangeKey,
  cvAnalyticsQueryFromRangeKey,
} from './queries'

describe('CV analytics range query keys', () => {
  test('serializes preset ranges to stable primitive keys', () => {
    const key = cvAnalyticsPresetRangeKey(7)
    expect(key).toBe('days:7')
    expect(cvAnalyticsQueryFromRangeKey(key)).toEqual({ days: 7 })
  })

  test('serializes complete custom ranges without object identity', () => {
    const key = cvAnalyticsCustomRangeKey('2026-07-15', '2026-07-21')
    expect(key).toBe('custom:2026-07-15:2026-07-21')
    expect(cvAnalyticsQueryFromRangeKey(key)).toEqual({
      from: '2026-07-15',
      to: '2026-07-21',
    })
  })
})
