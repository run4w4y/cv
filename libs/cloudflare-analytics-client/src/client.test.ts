import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { Configuration, type Interface, layer, Service } from './client'
import { cloudflarePayload, testConfiguration } from './test-fixtures'

type FetchResponse = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

interface ClientOptions {
  readonly readLimits?: () => Response | Promise<Response>
}

const defaultLimitsPayload = {
  data: {
    viewer: {
      zones: [
        {
          settings: {
            httpRequestsAdaptiveGroups: {
              enabled: true,
              maxDuration: 86_400,
              maxPageSize: 5_000,
              notOlderThan: 2_678_400,
            },
          },
        },
      ],
    },
  },
  errors: null,
} as const

const makeFetch = (respond: FetchResponse): typeof globalThis.fetch =>
  Object.assign(respond, { preconnect: globalThis.fetch.preconnect })

const withClient = <A, E>(
  respond: FetchResponse,
  use: (client: Interface) => Effect.Effect<A, E>,
  options: ClientOptions = {}
) => {
  const respondWithLimits: FetchResponse = async (input, init) =>
    isLimitsRequest(init)
      ? await (options.readLimits?.() ?? Response.json(defaultLimitsPayload))
      : respond(input, init)
  const httpLayer = FetchHttpClient.layer.pipe(
    Layer.provide(
      Layer.succeed(FetchHttpClient.Fetch, makeFetch(respondWithLimits))
    )
  )
  const dependencies = Layer.merge(
    Layer.succeed(Configuration, testConfiguration),
    httpLayer
  )

  return Service.use(use).pipe(
    Effect.provide(layer.pipe(Layer.provide(dependencies)))
  )
}

const runWithClient = <A, E>(
  respond: FetchResponse,
  use: (client: Interface) => Effect.Effect<A, E>,
  options?: ClientOptions
) => Effect.runPromise(withClient(respond, use, options))

const requestBodyText = (body: BodyInit | null | undefined) =>
  body instanceof Uint8Array
    ? new TextDecoder().decode(body)
    : typeof body === 'string'
      ? body
      : String(body)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isLimitsRequest = (init: RequestInit | undefined) => {
  const body = JSON.parse(requestBodyText(init?.body))
  return (
    isRecord(body) &&
    typeof body.query === 'string' &&
    body.query.includes('query AnalyticsLimits')
  )
}

const readRequestRange = (init: RequestInit | undefined) => {
  const body = JSON.parse(requestBodyText(init?.body))

  if (!isRecord(body) || !isRecord(body.variables)) {
    throw new Error('Missing GraphQL variables')
  }

  const filter = body.variables.filter

  if (!isRecord(filter) || !Array.isArray(filter.AND)) {
    throw new Error('Missing GraphQL filter')
  }

  const rangeFilter = filter.AND.find(
    (entry) =>
      isRecord(entry) &&
      typeof entry.datetime_geq === 'string' &&
      typeof entry.datetime_lt === 'string'
  )

  if (!isRecord(rangeFilter)) {
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
                clientRequestPath: '/c/home',
                datetimeDay: range.from.slice(0, 10),
              },
              sum: {
                visits: 1,
              },
            },
          ],
        },
      ],
    },
  },
  errors: null,
})

const addMilliseconds = (date: Date, milliseconds: number) =>
  new Date(date.getTime() + milliseconds)

const recentRange = () => {
  const from = addMilliseconds(new Date(), -2 * 24 * 60 * 60 * 1000)
  const to = addMilliseconds(from, 24 * 60 * 60 * 1000)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

describe('CloudflareAnalytics', () => {
  test('discovers and caches provider dataset limits', async () => {
    let limitRequests = 0

    const values = await runWithClient(
      async () => {
        throw new Error('Analytics data should not be requested.')
      },
      (client) => Effect.all([client.readLimits(), client.readLimits()]),
      {
        readLimits: () => {
          limitRequests += 1
          return Response.json(defaultLimitsPayload)
        },
      }
    )

    expect(values).toEqual([
      {
        maxDurationMs: 86_400_000,
        maxPageSize: 5_000,
        retentionMs: 2_678_400_000,
      },
      {
        maxDurationMs: 86_400_000,
        maxPageSize: 5_000,
        retentionMs: 2_678_400_000,
      },
    ])
    expect(limitRequests).toBe(1)
  })

  test('does not cache failed provider-limit discovery', async () => {
    let limitRequests = 0

    const exits = await runWithClient(
      async () => {
        throw new Error('Analytics data should not be requested.')
      },
      (client) =>
        Effect.gen(function* () {
          const first = yield* Effect.exit(client.readLimits())
          const second = yield* Effect.exit(client.readLimits())
          return [first, second]
        }),
      {
        readLimits: () => {
          limitRequests += 1
          return Response.json({
            data: { viewer: { zones: [] } },
            errors: null,
          })
        },
      }
    )

    expect(exits.every((exit) => exit._tag === 'Failure')).toBe(true)
    expect(limitRequests).toBe(2)
  })

  test('keeps exact CV paths inside the adapter boundary', async () => {
    const token = 'secret-publication-token'
    let requestBody: unknown
    const payload = {
      data: {
        viewer: {
          zones: [
            {
              dailyPaths: [
                {
                  count: 2,
                  dimensions: {
                    clientCountryName: 'Germany',
                    clientRequestPath: `/c/${token}`,
                    datetimeDay: new Date().toISOString().slice(0, 10),
                  },
                  sum: { visits: 1 },
                },
              ],
            },
          ],
        },
      },
      errors: null,
    }

    const data = await runWithClient(
      async (_input, init) => {
        requestBody = JSON.parse(requestBodyText(init?.body))
        return new Response(JSON.stringify(payload))
      },
      (client) =>
        client.readAliasedPaths({
          aliases: [{ key: 'cv-link-1', path: `/c/${token}` }],
          range: recentRange(),
        })
    )

    expect(data.records[0]?.totals).toEqual({ pageViews: 2, visits: 1 })
    expect(JSON.stringify(data)).not.toContain(token)
    expect(requestBody).toMatchObject({
      variables: {
        filter: {
          AND: expect.arrayContaining([{ clientRequestPath_like: '/c/%' }]),
        },
      },
    })
  })

  test('uses configuration and transport supplied by layers', async () => {
    let requestUrl: string | undefined
    let requestHeaders: Headers | undefined

    const data = await runWithClient(
      async (input, init) => {
        requestUrl = String(input)
        requestHeaders = new Headers(init?.headers)
        return new Response(JSON.stringify(cloudflarePayload), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      },
      (client) =>
        client.readAliasedPaths({
          aliases: [{ key: 'home', path: '/c/home' }],
          range: recentRange(),
        })
    )

    expect(data.records[0]?.totals).toEqual({ pageViews: 8, visits: 5 })
    expect(requestUrl).toBe(testConfiguration.endpoint.toString())
    expect(requestHeaders?.get('authorization')).toBe('Bearer secret-token')
    expect(JSON.stringify(data)).not.toContain('secret-token')
  })

  test('chunks wider ranges into daily Cloudflare requests', async () => {
    const requestedRanges: Array<{ from: string; to: string }> = []
    const rangeFrom = addMilliseconds(new Date(), -2 * 24 * 60 * 60 * 1000)
    const firstChunkTo = addMilliseconds(rangeFrom, 24 * 60 * 60 * 1000)
    const rangeTo = addMilliseconds(rangeFrom, 2 * 24 * 60 * 60 * 1000)

    const data = await runWithClient(
      async (_input, init) => {
        const range = readRequestRange(init)
        requestedRanges.push(range)

        return new Response(JSON.stringify(payloadForRange(range)), {
          status: 200,
        })
      },
      (client) =>
        client.readAliasedPaths({
          aliases: [{ key: 'home', path: '/c/home' }],
          range: {
            from: rangeFrom.toISOString(),
            to: rangeTo.toISOString(),
          },
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
    expect(data.records[0]?.totals).toEqual({ pageViews: 2, visits: 2 })
    expect(data.range).toMatchObject({
      from: rangeFrom.toISOString(),
      to: rangeTo.toISOString(),
    })
  })

  test('surfaces GraphQL response errors as typed failures', async () => {
    const result = await Effect.runPromiseExit(
      withClient(
        async () =>
          new Response(JSON.stringify({ errors: [{ message: 'bad zone' }] }), {
            status: 200,
          }),
        (client) =>
          client.readAliasedPaths({
            aliases: [{ key: 'home', path: '/c/home' }],
            range: recentRange(),
          })
      )
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('CloudflareAnalytics.GraphQLError')
  })

  test('rejects malformed analytics payloads instead of returning zero traffic', async () => {
    const result = await Effect.runPromiseExit(
      withClient(
        async () =>
          Response.json({
            data: { unexpected: true },
            errors: null,
          }),
        (client) =>
          client.readAliasedPaths({
            aliases: [{ key: 'home', path: '/c/home' }],
            range: recentRange(),
          })
      )
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('CloudflareAnalytics.ResponseError')
  })

  test('rejects invalid metrics and dates at the response boundary', async () => {
    const token = 'private-token'
    const result = await Effect.runPromiseExit(
      withClient(
        async () =>
          Response.json({
            data: {
              viewer: {
                zones: [
                  {
                    dailyPaths: [
                      {
                        count: -7,
                        dimensions: {
                          clientCountryName: 'Germany',
                          clientRequestPath: `/c/${token}`,
                          datetimeDay: 'not-a-date',
                        },
                        sum: { visits: 'garbage' },
                      },
                    ],
                  },
                ],
              },
            },
            errors: null,
          }),
        (client) =>
          client.readAliasedPaths({
            aliases: [{ key: 'home', path: `/c/${token}` }],
            range: recentRange(),
          })
      )
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('CloudflareAnalytics.ResponseError')
    expect(result.toString()).not.toContain(token)
  })

  test('rejects malformed GraphQL error envelopes', async () => {
    const result = await Effect.runPromiseExit(
      withClient(
        async () => Response.json({ errors: [{ detail: 'missing message' }] }),
        (client) =>
          client.readAliasedPaths({
            aliases: [{ key: 'home', path: '/c/home' }],
            range: recentRange(),
          })
      )
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('CloudflareAnalytics.ResponseError')
  })

  test('fails loudly when Cloudflare fills the result page', async () => {
    const result = await Effect.runPromiseExit(
      withClient(
        async () =>
          Response.json({
            data: {
              viewer: {
                zones: [
                  {
                    dailyPaths: [
                      {
                        count: 1,
                        dimensions: {
                          clientCountryName: 'Germany',
                          clientRequestPath: '/c/home',
                          datetimeDay: new Date().toISOString().slice(0, 10),
                        },
                        sum: { visits: 1 },
                      },
                    ],
                  },
                ],
              },
            },
            errors: null,
          }),
        (client) =>
          client.readAliasedPaths({
            aliases: [{ key: 'home', path: '/c/home' }],
            range: recentRange(),
          }),
        {
          readLimits: () =>
            Response.json({
              data: {
                viewer: {
                  zones: [
                    {
                      settings: {
                        httpRequestsAdaptiveGroups: {
                          enabled: true,
                          maxDuration: 86_400,
                          maxPageSize: 1,
                          notOlderThan: 2_678_400,
                        },
                      },
                    },
                  ],
                },
              },
              errors: null,
            }),
        }
      )
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('CloudflareAnalytics.ResultLimitError')
  })

  test('returns empty data without contacting Cloudflare for empty aliases', async () => {
    let requests = 0
    const data = await runWithClient(
      async () => {
        requests += 1
        throw new Error('Cloudflare should not be contacted.')
      },
      (client) =>
        client.readAliasedPaths({
          aliases: [],
          range: recentRange(),
        }),
      {
        readLimits: () => {
          requests += 1
          return Response.json(defaultLimitsPayload)
        },
      }
    )

    expect(data.records).toEqual([])
    expect(requests).toBe(0)
  })
})
