import { describe, expect, test } from 'bun:test'

import { normalizeAliasedPaths } from './aliased-normalize'

const range = {
  from: '2026-07-18T00:00:00.000Z',
  to: '2026-07-19T00:00:00.000Z',
}
const generatedAt = '2026-07-19T00:00:00.000Z'

describe('aliased Cloudflare path normalization', () => {
  test('returns application-owned keys and omits the matched paths', () => {
    const token = 'publication-secret-token'
    const result = normalizeAliasedPaths(
      [
        {
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
                      clientRequestPath: '/c/unrelated',
                      datetimeDay: '2026-07-18',
                    },
                    sum: { visits: 4 },
                  },
                ],
              },
            ],
          },
        },
      ],
      range,
      [{ key: 'link-1', path: `/c/${token}` }],
      generatedAt
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

  test('includes zero-visit aliases', () => {
    const result = normalizeAliasedPaths(
      [],
      range,
      [{ key: 'link-1', path: '/c/unseen' }],
      generatedAt
    )

    expect(result.records[0]).toMatchObject({
      key: 'link-1',
      totals: { pageViews: 0, visits: 0 },
    })
  })

  test('preserves an explicit zero visit metric', () => {
    const result = normalizeAliasedPaths(
      [
        {
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
              },
            ],
          },
        },
      ],
      range,
      [{ key: 'link-1', path: '/c/zero-visits' }],
      generatedAt
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
})
