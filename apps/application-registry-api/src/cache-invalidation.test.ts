import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import {
  CvCacheInvalidator,
  makeCvCacheInvalidatorLayer,
} from './cache-invalidation'

describe('CvCacheInvalidator', () => {
  test('retries a transient HTTP failure and sends the token purge', async () => {
    const bodies: unknown[] = []
    let attempts = 0
    const request = async (input: RequestInfo | URL, init?: RequestInit) => {
      attempts += 1
      bodies.push(await new Request(input, init).json())
      return new Response(null, { status: attempts < 3 ? 503 : 200 })
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const invalidator = yield* CvCacheInvalidator
        yield* invalidator.invalidate({ token: 'cv-token' })
      }).pipe(
        Effect.provide(
          makeCvCacheInvalidatorLayer(
            {
              origin: new URL('https://cv.example.test'),
              secret: 'cache-secret',
            },
            request
          )
        )
      )
    )

    expect(attempts).toBe(3)
    expect(bodies).toEqual([
      { token: 'cv-token' },
      { token: 'cv-token' },
      { token: 'cv-token' },
    ])
  })

  test('skips invalidation when it is not configured', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const invalidator = yield* CvCacheInvalidator
        yield* invalidator.invalidate({ all: true })
      }).pipe(Effect.provide(makeCvCacheInvalidatorLayer(undefined)))
    )
  })
})
