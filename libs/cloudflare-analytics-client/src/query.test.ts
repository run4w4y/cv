import { describe, expect, test } from 'bun:test'

import {
  buildLimitsQuery,
  buildLimitsVariables,
  buildQuery,
  buildVariables,
} from './query'
import { makeRange } from './range'
import { testConfiguration } from './test-fixtures'

describe('cloudflare analytics query', () => {
  test('keeps the grouped query shape needed for aliased path analytics', () => {
    const query = buildQuery()

    expect(query).toContain('query AliasedPathAnalytics')
    expect(query).toContain('topPaths: httpRequestsAdaptiveGroups')
    expect(query).toContain('dailyPaths: httpRequestsAdaptiveGroups')
    expect(query).toContain('orderBy: [date_ASC]')
    expect(query).toContain('clientRequestPath')
    expect(query).toContain('datetimeDay: date')
    expect(query).not.toContain('uniq')
    expect(query).not.toContain('secret-token')
  })

  test('queries the configured dataset limits', () => {
    expect(buildLimitsQuery()).toContain('httpRequestsAdaptiveGroups')
    expect(buildLimitsQuery()).toContain('notOlderThan')
    expect(buildLimitsQuery()).toContain('maxDuration')
    expect(buildLimitsVariables(testConfiguration)).toEqual({
      zoneTag: 'zone-123',
    })
  })

  test('uses the provider page-size limit for analytics groups', () => {
    const query = buildQuery(750)

    expect(query).toContain('limit: 750')
    expect(query).not.toContain('limit: 1000')
    expect(query).not.toContain('limit: 5000')
  })

  test('builds variables with host and range filters', () => {
    const range = makeRange({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-20T00:00:00.000Z',
    })
    const variables = buildVariables(testConfiguration, range)

    expect(variables.zoneTag).toBe('zone-123')
    expect(variables.filter.AND).toContainEqual({
      datetime_geq: '2026-06-01T00:00:00.000Z',
      datetime_lt: '2026-06-20T00:00:00.000Z',
    })
    expect(variables.filter.AND).toContainEqual({
      clientRequestHTTPHost: 'cv.example.test',
    })
  })

  test('adds an optional provider-side path filter', () => {
    const range = makeRange({
      from: '2026-06-18T00:00:00.000Z',
      to: '2026-06-19T00:00:00.000Z',
    })
    const variables = buildVariables(testConfiguration, range, '/c/%')

    expect(variables.filter.AND).toContainEqual({
      clientRequestPath_like: '/c/%',
    })
  })
})
