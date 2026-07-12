import { describe, expect, test } from 'bun:test'
import { Effect, Layer, Redacted } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { makeApplicationRegistryHttpClient } from './client'

const makeFetch = (
  respond: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): typeof globalThis.fetch =>
  Object.assign(respond, { preconnect: globalThis.fetch.preconnect })

describe('application registry HTTP client', () => {
  test('uses the declared base URL and bearer token', async () => {
    let request: Request | undefined
    const fetch = makeFetch((input, init) => {
      request = input instanceof Request ? input : new Request(input, init)
      return Promise.resolve(Response.json({ ok: true }))
    })
    const fetchLayer = FetchHttpClient.layer.pipe(
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))
    )

    const result = await Effect.runPromise(
      makeApplicationRegistryHttpClient({
        baseUrl: new URL('https://registry.example.test/root/'),
        token: Redacted.make('registry-token'),
      }).pipe(
        Effect.flatMap((client) => client.health()),
        Effect.provide(fetchLayer)
      )
    )

    expect(result).toEqual({ ok: true })
    expect(request?.url).toBe('https://registry.example.test/root/health')
    expect(request?.headers.get('authorization')).toBe('Bearer registry-token')
  })
})
