import { describe, expect, test } from 'bun:test'
import * as Effect from 'effect/Effect'
import { isPlainObject } from 'es-toolkit/predicate'

import {
  fetchCloudflareAnalyticsDashboardData,
  fetchCloudflareAnalyticsDashboardDataFromEnv,
} from './client'
import { createCloudflareAnalyticsRange } from './range'
import { cloudflarePayload, testConfig } from './test-fixtures'

const readRequestRange = (init: RequestInit | undefined) => {
  const body = JSON.parse(String(init?.body))

  if (!isPlainObject(body) || !isPlainObject(body.variables)) {
    throw new Error('Missing GraphQL variables')
  }

  const filter = body.variables.filter

  if (!isPlainObject(filter) || !Array.isArray(filter.AND)) {
    throw new Error('Missing GraphQL filter')
  }

  const rangeFilter = filter.AND.find(
    (entry) =>
      isPlainObject(entry) &&
      typeof entry.datetime_geq === 'string' &&
      typeof entry.datetime_lt === 'string'
  )

  if (!isPlainObject(rangeFilter)) {
    throw new Error('Missing GraphQL range filter')
  }

  return {
    from: String(rangeFilter.datetime_geq),
    to: String(rangeFilter.datetime_lt),
  }
}

const payloadForRange = (range: { readonly from: string }) => ({
  data: {
    viewer: {
      zones: [
        {
          dailyPaths: [
            {
              count: 1,
              dimensions: {
                clientCountryName: 'Germany',
                clientRequestPath: '/en/',
                datetimeDay: range.from.slice(0, 10),
              },
              sum: {
                visits: 1,
              },
            },
          ],
          topPaths: [],
        },
      ],
    },
  },
})

const addMilliseconds = (date: Date, milliseconds: number) =>
  new Date(date.getTime() + milliseconds)

const createRecentTestRange = () => {
  const from = addMilliseconds(new Date(), -2 * 24 * 60 * 60 * 1000)
  const to = addMilliseconds(from, 24 * 60 * 60 * 1000)

  return createCloudflareAnalyticsRange({
    from: from.toISOString(),
    to: to.toISOString(),
  })
}

describe('cloudflare analytics client', () => {
  test('performs the request with Authorization only at the fetch boundary', async () => {
    const requests: RequestInit[] = []
    const fetchImplementation = async (
      _input: string | URL,
      init?: RequestInit
    ) => {
      requests.push(init ?? {})

      return new Response(JSON.stringify(cloudflarePayload), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 200,
      })
    }

    const data = await Effect.runPromise(
      fetchCloudflareAnalyticsDashboardData({
        config: testConfig,
        fetch: fetchImplementation,
        range: createRecentTestRange(),
      })
    )

    expect(data.audiences).toHaveLength(1)
    expect(requests[0]?.headers).toMatchObject({
      Authorization: 'Bearer secret-token',
    })
    expect(JSON.stringify(data)).not.toContain('secret-token')
  })

  test('keeps env loading and fetching composable as an Effect', async () => {
    const data = await Effect.runPromise(
      fetchCloudflareAnalyticsDashboardDataFromEnv({
        env: {
          CLOUDFLARE_API_TOKEN: 'token-value',
          CLOUDFLARE_ZONE_ID: 'zone-value',
        },
        fetch: async () =>
          new Response(JSON.stringify(cloudflarePayload), {
            status: 200,
          }),
        range: createRecentTestRange(),
      })
    )

    expect(data.schema).toBe('analytics.dashboard.v2')
  })

  test('chunks wider ranges into daily Cloudflare requests', async () => {
    const requestedRanges: Array<{ from: string; to: string }> = []
    const rangeFrom = addMilliseconds(new Date(), -2 * 24 * 60 * 60 * 1000)
    const firstChunkTo = addMilliseconds(rangeFrom, 24 * 60 * 60 * 1000)
    const rangeTo = addMilliseconds(rangeFrom, 2 * 24 * 60 * 60 * 1000)

    const data = await Effect.runPromise(
      fetchCloudflareAnalyticsDashboardData({
        config: testConfig,
        fetch: async (_input, init) => {
          const range = readRequestRange(init)
          requestedRanges.push(range)

          return new Response(JSON.stringify(payloadForRange(range)), {
            status: 200,
          })
        },
        range: createCloudflareAnalyticsRange({
          from: rangeFrom.toISOString(),
          to: rangeTo.toISOString(),
        }),
      })
    )

    expect(requestedRanges).toEqual([
      {
        from: rangeFrom.toISOString(),
        to: firstChunkTo.toISOString(),
      },
      {
        from: firstChunkTo.toISOString(),
        to: rangeTo.toISOString(),
      },
    ])
    expect(data.summary.publicViews).toBe(2)
    expect(data.range).toMatchObject({
      from: rangeFrom.toISOString(),
      to: rangeTo.toISOString(),
    })
  })

  test('surfaces GraphQL response errors as typed failures', async () => {
    const result = await Effect.runPromiseExit(
      fetchCloudflareAnalyticsDashboardData({
        config: testConfig,
        fetch: async () =>
          new Response(
            JSON.stringify({
              errors: [{ message: 'bad zone' }],
            }),
            { status: 200 }
          ),
        range: createCloudflareAnalyticsRange(),
      })
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('CloudflareAnalyticsGraphQLError')
  })
})
