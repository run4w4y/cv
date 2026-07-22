import { describe, expect, test } from 'bun:test'
import * as Effect from 'effect/Effect'

import { normalizeAliasedPaths } from './aliased-normalize'

const range = {
  from: '2026-07-18T00:00:00.000Z',
  to: '2026-07-19T00:00:00.000Z',
}

describe('aliased Cloudflare path normalization', () => {
  test('returns application-owned keys and omits the matched paths', async () => {
    const token = 'publication-secret-token'
    const result = await Effect.runPromise(
      normalizeAliasedPaths(
        [
          {
            data: {
              viewer: {
                zones: [
                  {
                    dailyPaths: [
                      {
                        count: 5,
                        dimensions: {
                          clientCountryName: 'Germany',
                          clientRequestPath: `/c/${token}`,
                          datetimeDay: '2026-07-18',
                        },
                        sum: { visits: 3 },
                      },
                      {
                        count: 8,
                        dimensions: {
                          clientCountryName: 'Netherlands',
                          clientRequestPath: '/unrelated',
                          datetimeDay: '2026-07-18',
                        },
                        sum: { visits: 4 },
                      },
                    ],
                    topPaths: [],
                  },
                ],
              },
            },
          },
        ],
        range,
        [{ key: 'link-1', path: `/c/${token}` }]
      )
    )

    expect(result.records).toEqual([
      {
        countries: { Germany: 3 },
        key: 'link-1',
        series: [
          {
            at: '2026-07-18',
            pageViews: 5,
            visits: 3,
          },
        ],
        totals: { pageViews: 5, visits: 3 },
      },
    ])
    expect(JSON.stringify(result)).not.toContain(token)
    expect(JSON.stringify(result)).not.toContain('/c/')
  })

  test('includes zero-visit aliases', async () => {
    const result = await Effect.runPromise(
      normalizeAliasedPaths([], range, [{ key: 'link-1', path: '/c/unseen' }])
    )

    expect(result.records[0]).toMatchObject({
      key: 'link-1',
      totals: { pageViews: 0, visits: 0 },
    })
  })

  test('preserves an explicit zero visit metric', async () => {
    const result = await Effect.runPromise(
      normalizeAliasedPaths(
        [
          {
            data: {
              viewer: {
                zones: [
                  {
                    dailyPaths: [
                      {
                        count: 5,
                        dimensions: {
                          clientCountryName: 'Germany',
                          clientRequestPath: '/c/zero-visits',
                          datetimeDay: '2026-07-18',
                        },
                        sum: { visits: 0 },
                      },
                    ],
                    topPaths: [],
                  },
                ],
              },
            },
          },
        ],
        range,
        [{ key: 'link-1', path: '/c/zero-visits' }]
      )
    )

    expect(result.records[0]).toEqual({
      countries: {},
      key: 'link-1',
      series: [
        {
          at: '2026-07-18',
          pageViews: 5,
          visits: 0,
        },
      ],
      totals: { pageViews: 5, visits: 0 },
    })
  })

  test('rejects duplicate alias keys before reading provider data', async () => {
    const result = await Effect.runPromiseExit(
      normalizeAliasedPaths([], range, [
        { key: 'link-1', path: '/c/one' },
        { key: 'link-1', path: '/c/two' },
      ])
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('CloudflareAnalytics.NormalizeError')
  })
})
