import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertAnalyticsDashboardData } from './assert-dashboard-data'
import { ANALYTICS_DASHBOARD_SCHEMA } from './constants'

const rootDir = fileURLToPath(new URL('../../..', import.meta.url))
const fixturePath = (name: string) =>
  resolve(rootDir, 'fixtures', 'analytics', name)
const readFixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(fixturePath(name), 'utf8'))

describe('assertAnalyticsDashboardData', () => {
  test('accepts valid dashboard data', async () => {
    const publicSample = assertAnalyticsDashboardData(
      await readFixture('public-sample.json')
    )

    expect(assertAnalyticsDashboardData(publicSample)).toEqual(publicSample)
  })

  test('rejects invalid or unsafe dashboard data', async () => {
    const publicSample = assertAnalyticsDashboardData(
      await readFixture('public-sample.json')
    )

    expect(() =>
      assertAnalyticsDashboardData({
        ...publicSample,
        schema: 'analytics.dashboard.v0',
      })
    ).toThrow(ANALYTICS_DASHBOARD_SCHEMA)

    expect(() =>
      assertAnalyticsDashboardData({
        ...publicSample,
        audiences: [
          {
            audienceId: 'leaky',
            locale: 'en',
            path: '/en/a/leaky/?p=AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA',
            series: [],
            totals: {
              pageViews: 1,
              visits: 1,
              visitors: 1,
            },
          },
        ],
      })
    ).toThrow('private content token')

    expect(() =>
      assertAnalyticsDashboardData({
        ...publicSample,
        paths: [
          {
            countries: {},
            devices: {},
            kind: 'public',
            path: '/en/',
            referrers: {
              'person@example.invalid': 1,
            },
            series: [],
            totals: {
              pageViews: 1,
              visits: 1,
              visitors: 1,
            },
          },
        ],
      })
    ).toThrow('raw personal identifiers')
  })
})
