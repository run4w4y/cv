import { describe, expect, test } from 'bun:test'
import * as Effect from 'effect/Effect'
import { extractGraphqlErrors, normalizeResponse } from './normalize'
import { makeRange } from './range'
import { cloudflarePayload } from './test-fixtures'

describe('cloudflare analytics normalization', () => {
  test('normalizes daily rows without double counting top path rows', async () => {
    const data = await Effect.runPromise(
      normalizeResponse(
        cloudflarePayload,
        makeRange({
          from: '2026-06-17',
          to: '2026-06-18',
        })
      )
    )

    expect(data.summary.audienceViews).toBe(4)
    expect(data.summary.publicViews).toBe(8)
    expect(JSON.stringify(data)).not.toMatch(/[?&]p=/u)
  })

  test('sums country groups into one daily path point', async () => {
    const data = await Effect.runPromise(
      normalizeResponse(
        {
          data: {
            viewer: {
              zones: [
                {
                  dailyPaths: [
                    {
                      count: 4,
                      dimensions: {
                        clientCountryName: 'Germany',
                        clientRequestPath: '/en/',
                        datetimeDay: '2026-06-18',
                      },
                      sum: { visits: 3 },
                    },
                    {
                      count: 5,
                      dimensions: {
                        clientCountryName: 'Netherlands',
                        clientRequestPath: '/en/',
                        datetimeDay: '2026-06-18',
                      },
                      sum: { visits: 2 },
                    },
                  ],
                  topPaths: [],
                },
              ],
            },
          },
        },
        makeRange({
          from: '2026-06-18',
          to: '2026-06-19',
        })
      )
    )

    expect(data.paths[0]?.series).toEqual([
      {
        at: '2026-06-18',
        pageViews: 9,
        visits: 5,
      },
    ])
  })

  test('extracts GraphQL error messages without returning raw payloads', () => {
    expect(
      extractGraphqlErrors({
        errors: [{ message: 'bad zone' }, { detail: 'ignored' }],
      })
    ).toEqual(['bad zone'])
  })
})
