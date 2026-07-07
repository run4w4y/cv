import { afterEach, describe, expect, test } from 'bun:test'
import type { GrafanaAnalyticsTables } from '@cv/analytics-grafana'

import worker from './index'
import type {
  AnalyticsConnectorEnv,
  WorkerExecutionContext,
} from './worker/types'

const context: WorkerExecutionContext = {
  waitUntil: () => undefined,
}

const originalCachesDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'caches'
)

const restoreCaches = () => {
  if (originalCachesDescriptor) {
    Object.defineProperty(globalThis, 'caches', originalCachesDescriptor)
    return
  }

  Reflect.deleteProperty(globalThis, 'caches')
}

afterEach(() => {
  restoreCaches()
})

const env = {
  ANALYTICS_FALLBACK: 'sample',
  PRIVATE_CONTENT_AUDIENCE_KEY:
    'test-private-audience-key-with-at-least-thirty-two-bytes',
  GRAFANA_CONNECTOR_TOKEN: 'test-token',
} satisfies AnalyticsConnectorEnv

const cachedTables = {
  audienceDaily: [],
  audienceDimensions: [],
  audiences: [
    {
      archived: false,
      audience_id: 'cached',
      company: 'Cached target',
      created_at: '',
      first_seen: '',
      label: '',
      last_seen: '',
      locale: 'en',
      page_views: 12,
      path: '/en/a/cached/',
      pdf_exported_at: '',
      profile_id: '',
      qr_verified_at: '',
      role: 'Staff Engineer',
      stacks: 'Effect, Cloudflare',
      stage: 'cached',
      variant: '',
      visitors: 3,
      visits: 4,
    },
  ],
  paths: [],
  summary: [
    {
      active_audiences: 1,
      audience_views: 12,
      generated_at: '2026-06-23T00:00:00.000Z',
      public_views: 0,
      range_from: '2026-06-22T00:00:00.000Z',
      range_to: '2026-06-23T00:00:00.000Z',
      zero_visit_audiences: 0,
    },
  ],
} satisfies GrafanaAnalyticsTables

const request = (
  path: string,
  token: string | null = env.GRAFANA_CONNECTOR_TOKEN
) =>
  new Request(`https://analytics.example.test${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

describe('analytics connector worker', () => {
  test('serves health without auth', async () => {
    const response = await worker.fetch(request('/health'), env, context)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  test('serves cors preflight without auth', async () => {
    const response = await worker.fetch(
      new Request('https://analytics.example.test/v1/audiences', {
        headers: {
          'Access-Control-Request-Method': 'GET',
          Origin: 'https://grafana.example.test',
        },
        method: 'OPTIONS',
      }),
      env,
      context
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  test('rejects unsupported methods with json error', async () => {
    const response = await worker.fetch(
      new Request('https://analytics.example.test/v1/audiences', {
        method: 'POST',
      }),
      env,
      context
    )

    expect(response.status).toBe(405)
    expect(await response.json()).toEqual({
      code: 'method_not_allowed',
      message: 'Only GET is supported.',
    })
  })

  test('returns json not found for unknown routes', async () => {
    const response = await worker.fetch(request('/not-here'), env, context)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      code: 'not_found',
      message: 'Unknown analytics connector route.',
    })
  })

  test('requires bearer auth for table endpoints', async () => {
    const response = await worker.fetch(
      request('/v1/audiences', null),
      env,
      context
    )

    expect(response.status).toBe(401)
  })

  test('returns flattened audience rows from observed paths', async () => {
    const response = await worker.fetch(request('/v1/audiences'), env, context)
    const rows = await response.json()

    expect(response.status).toBe(200)
    expect(JSON.stringify(rows)).not.toContain('?p=')
    expect(rows).toContainEqual(
      expect.objectContaining({
        audience_id: 'frontend-alpha',
        profile_id: '',
        company: 'Frontend target',
        page_views: 6,
        visits: 4,
      })
    )
  })

  test('returns variable rows for Grafana dashboard filters', async () => {
    const response = await worker.fetch(
      request('/v1/variables/stages'),
      env,
      context
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toContainEqual({
      label: 'Shared',
      value: 'Shared',
    })
  })

  test('does not serve cached table responses before auth passes', async () => {
    let cacheReadCount = 0

    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        default: {
          match: () => {
            cacheReadCount += 1

            return Promise.resolve(
              new Response(JSON.stringify(cachedTables), {
                headers: { 'Content-Type': 'application/json' },
              })
            )
          },
          put: () => Promise.resolve(),
        },
      },
    })

    const response = await worker.fetch(
      request('/v1/audiences', null),
      env,
      context
    )

    expect(response.status).toBe(401)
    expect(cacheReadCount).toBe(0)
  })

  test('serves cached analytics tables after auth passes', async () => {
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        default: {
          match: () =>
            Promise.resolve(
              new Response(JSON.stringify(cachedTables), {
                headers: { 'Content-Type': 'application/json' },
              })
            ),
          put: () => Promise.resolve(),
        },
      },
    })

    const response = await worker.fetch(request('/v1/audiences'), env, context)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(cachedTables.audiences)
  })

  test('stores generated table responses after auth passes', async () => {
    const scheduled: Promise<unknown>[] = []
    let cachedRequestUrl = ''
    let cachedResponse: Response | undefined

    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        default: {
          match: () => Promise.resolve(undefined),
          put: (cacheKey: Request, response: Response) => {
            cachedRequestUrl = cacheKey.url
            cachedResponse = response.clone()

            return Promise.resolve()
          },
        },
      },
    })

    const response = await worker.fetch(
      request('/v1/audiences?to=2026-01-02&from=2026-01-01'),
      env,
      {
        waitUntil: (promise) => {
          scheduled.push(promise)
        },
      }
    )

    expect(response.status).toBe(200)
    expect(cachedRequestUrl).toBe(
      'https://analytics-connector.internal/v1/tables?from=2026-01-01&to=2026-01-02'
    )
    expect(cachedResponse?.headers.get('Cache-Control')).toBe(
      'private, max-age=600, s-maxage=600'
    )
    expect(cachedResponse).toBeDefined()
    expect(await cachedResponse?.json()).toHaveProperty('audiences')
    expect(scheduled).toHaveLength(1)
    await Promise.all(scheduled)
  })
})
