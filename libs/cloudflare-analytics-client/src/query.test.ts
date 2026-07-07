import { describe, expect, test } from 'bun:test'

import {
  buildCloudflareAnalyticsQuery,
  buildCloudflareAnalyticsVariables,
} from './query'
import { createCloudflareAnalyticsRange } from './range'
import { testConfig } from './test-fixtures'

describe('cloudflare analytics query', () => {
  test('keeps the CLI query shape needed for audience analytics', () => {
    const query = buildCloudflareAnalyticsQuery()

    expect(query).toContain('query AudienceAnalytics')
    expect(query).toContain('topPaths: httpRequestsAdaptiveGroups')
    expect(query).toContain('dailyPaths: httpRequestsAdaptiveGroups')
    expect(query).toContain('orderBy: [date_ASC]')
    expect(query).toContain('clientRequestPath')
    expect(query).toContain('datetimeDay: date')
    expect(query).not.toContain('secret-token')
  })

  test('builds variables with host and range filters', () => {
    const range = createCloudflareAnalyticsRange({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-20T00:00:00.000Z',
    })
    const variables = buildCloudflareAnalyticsVariables(testConfig, range)

    expect(variables.zoneTag).toBe('zone-123')
    expect(variables.filter.AND).toContainEqual({
      datetime_geq: '2026-06-01T00:00:00.000Z',
      datetime_lt: '2026-06-20T00:00:00.000Z',
    })
    expect(variables.filter.AND).toContainEqual({
      clientRequestHTTPHost: 'cv.example.test',
    })
  })
})
