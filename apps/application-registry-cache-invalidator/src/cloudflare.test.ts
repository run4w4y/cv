import { describe, expect, test } from 'bun:test'
import { Effect, Fiber, Layer, Redacted } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import {
  CacheInvalidationPermanentError,
  CacheInvalidationTransientError,
  CacheInvalidator,
  makeCloudflareCacheInvalidatorLayer,
} from './cloudflare'

const configuration = {
  apiToken: Redacted.make('cache-purge-token'),
  endpoint: new URL('https://api.cloudflare.test/client/v4/'),
  publicBaseUrl: new URL('https://cv.example.test/c/'),
  zoneId: 'zone-id',
}

type FetchResponse = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

const makeFetch = (respond: FetchResponse): typeof globalThis.fetch =>
  Object.assign(respond, { preconnect: globalThis.fetch.preconnect })

const layer = (respond: FetchResponse) =>
  makeCloudflareCacheInvalidatorLayer(configuration).pipe(
    Layer.provide(
      FetchHttpClient.layer.pipe(
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, makeFetch(respond)))
      )
    )
  )

const invalidate = (respond: FetchResponse) =>
  CacheInvalidator.use((invalidator) => invalidator.invalidate()).pipe(
    Effect.provide(layer(respond))
  )

describe('Cloudflare cache invalidator', () => {
  test('purges the complete public CV prefix', async () => {
    const requests: Request[] = []
    const respond: FetchResponse = async (input, init) => {
      requests.push(input instanceof Request ? input : new Request(input, init))
      return Response.json({ errors: [], success: true })
    }

    await Effect.runPromise(invalidate(respond))

    expect(requests).toHaveLength(1)
    expect(requests[0]?.headers.get('authorization')).toBe(
      'Bearer cache-purge-token'
    )
    expect(await requests[0]?.json()).toEqual({
      prefixes: ['cv.example.test/c/'],
    })
  })

  test('classifies non-retryable HTTP responses as permanent failures', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        invalidate(() =>
          Promise.resolve(
            Response.json(
              {
                errors: [{ code: 1000, message: 'invalid request' }],
                success: false,
              },
              { status: 400 }
            )
          )
        )
      )
    )

    expect(failure).toBeInstanceOf(CacheInvalidationPermanentError)
  })

  for (const status of [408, 429, 500, 520]) {
    test(`classifies HTTP ${status} as a transient failure`, async () => {
      const failure = await Effect.runPromise(
        Effect.flip(
          invalidate(() =>
            Promise.resolve(
              Response.json(
                {
                  errors: [{ code: 1000, message: 'try again' }],
                  success: false,
                },
                { status }
              )
            )
          )
        )
      )

      expect(failure).toBeInstanceOf(CacheInvalidationTransientError)
    })
  }

  test('classifies transport failures as transient', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(invalidate(() => Promise.reject(new Error('unavailable'))))
    )

    expect(failure).toBeInstanceOf(CacheInvalidationTransientError)
  })

  test('classifies invalid successful responses as transient', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        invalidate(() =>
          Promise.resolve(Response.json({ errors: [], success: 'yes' }))
        )
      )
    )

    expect(failure).toBeInstanceOf(CacheInvalidationTransientError)
  })

  test('aborts the request when cache invalidation is interrupted', async () => {
    const started = Promise.withResolvers<void>()
    const aborted = Promise.withResolvers<void>()
    let requestSignal: AbortSignal | undefined
    const respond: FetchResponse = (_input, init) => {
      requestSignal = init?.signal ?? undefined
      started.resolve()
      return new Promise((_resolve, reject) => {
        if (requestSignal === undefined) {
          reject(new Error('Request did not receive an abort signal.'))
          return
        }
        requestSignal.addEventListener(
          'abort',
          () => {
            aborted.resolve()
            reject(requestSignal?.reason)
          },
          { once: true }
        )
      })
    }

    const fiber = Effect.runFork(invalidate(respond))
    await started.promise
    await Effect.runPromise(Fiber.interrupt(fiber))
    await aborted.promise

    expect(requestSignal?.aborted).toBe(true)
  })
})
