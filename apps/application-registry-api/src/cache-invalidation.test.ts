import { describe, expect, test } from 'bun:test'
import { Effect, Redacted } from 'effect'

import {
  CvCacheInvalidator,
  makeCvCacheInvalidatorLayer,
} from './cache-invalidation'

const configuration = {
  apiToken: Redacted.make('cloudflare-token'),
  endpoint: new URL('https://api.cloudflare.test/client/v4/'),
  host: 'cv.example.test',
  zoneId: 'zone-id',
}

describe('CvCacheInvalidator', () => {
  test('retries a transient HTTP failure and purges the exact public URL', async () => {
    const requests: Request[] = []
    const request = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init))
      return requests.length < 3
        ? new Response(null, { status: 503 })
        : Response.json({ errors: [], success: true })
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const invalidator = yield* CvCacheInvalidator
        yield* invalidator.invalidate({ token: 'cv token' })
      }).pipe(
        Effect.provide(makeCvCacheInvalidatorLayer(configuration, request))
      )
    )

    expect(requests).toHaveLength(3)
    expect(requests[0]?.url).toBe(
      'https://api.cloudflare.test/client/v4/zones/zone-id/purge_cache'
    )
    expect(requests[0]?.headers.get('authorization')).toBe(
      'Bearer cloudflare-token'
    )
    expect(await requests[2]?.json()).toEqual({
      files: ['https://cv.example.test/c/cv%20token'],
    })
  })

  test('purges only the CV path prefix for a full invalidation', async () => {
    let body: unknown
    const request = async (input: RequestInfo | URL, init?: RequestInit) => {
      body = await new Request(input, init).json()
      return Response.json({ errors: [], success: true })
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const invalidator = yield* CvCacheInvalidator
        yield* invalidator.invalidate({ all: true })
      }).pipe(
        Effect.provide(makeCvCacheInvalidatorLayer(configuration, request))
      )
    )

    expect(body).toEqual({ prefixes: ['cv.example.test/c/'] })
  })
})
