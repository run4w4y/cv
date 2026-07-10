import { describe, expect, test } from 'bun:test'

import { sampleAnalyticsDashboardData } from '@cv/analytics-core'

import { assertGrafanaRowsSafe } from './safety'
import { buildGrafanaAnalyticsTables } from './tables'

describe('buildGrafanaAnalyticsTables', () => {
  test('flattens dashboard data into Grafana-friendly tables', () => {
    const tables = buildGrafanaAnalyticsTables(sampleAnalyticsDashboardData())

    expect(tables.summary).toHaveLength(1)
    expect(tables.audiences.length).toBeGreaterThan(0)
    expect(tables.audienceDaily.length).toBeGreaterThan(0)
    expect(tables.audienceDimensions.length).toBeGreaterThan(0)
    expect(tables.paths.length).toBeGreaterThan(0)
    expect(tables.audiences[0]).toHaveProperty('audience_id')
    expect(tables.audienceDaily[0]).toHaveProperty('time')
    expect(JSON.stringify(tables)).not.toContain('visitors')
  })

  test('rejects private tokens and raw identifiers in Grafana output', () => {
    expect(() =>
      assertGrafanaRowsSafe([
        { path: '/en/a/x/?p=AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA' },
      ])
    ).toThrow('private content token')
    expect(() =>
      assertGrafanaRowsSafe([{ company: 'person@example.com' }])
    ).toThrow('raw personal identifiers')
    expect(() => assertGrafanaRowsSafe([{ company: '192.168.0.1' }])).toThrow(
      'raw personal identifiers'
    )
  })
})
