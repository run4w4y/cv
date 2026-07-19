import { describe, expect, test } from 'bun:test'
import { Effect, Layer, Redacted } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { FactsObjectStore } from './object-store'
import { factsR2ObjectStoreLayer } from './r2'

describe('R2 S3 transport', () => {
  test('signs a direct bucket request without exposing the secret in its URL', async () => {
    const requests: Request[] = []
    const bytes = new TextEncoder().encode('{"ok":true}')
    const secret = 'publisher-secret-that-must-not-leak'
    const browserFetch: typeof globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init)
        requests.push(request)
        return new Response(bytes, {
          headers: {
            'cache-control': 'private, no-cache',
            'content-length': String(bytes.byteLength),
            'content-type': 'application/json',
            etag: '"current"',
            'x-amz-meta-sha256': '0'.repeat(64),
          },
          status: 200,
        })
      },
      { preconnect: () => undefined }
    )
    const http = FetchHttpClient.layer.pipe(
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, browserFetch))
    )
    const layer = factsR2ObjectStoreLayer(
      {
        accessKeyId: Redacted.make('reader-access-key'),
        bucket: 'cv-facts',
        endpoint:
          'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
        secretAccessKey: Redacted.make(secret),
      },
      http
    )

    const object = await Effect.runPromise(
      FactsObjectStore.use((store) => store.get('current.json')).pipe(
        Effect.provide(layer)
      )
    )

    const request = requests[0]
    if (request === undefined) throw new Error('Expected one signed request.')
    expect(request.method).toBe('GET')
    const requestUrl = new URL(request.url)
    expect(requestUrl.origin).toBe(
      'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com'
    )
    expect(requestUrl.pathname).toBe('/cv-facts/current.json')
    expect(requestUrl.searchParams.get('x-id')).toBe('GetObject')
    expect(request.url).not.toContain(secret)
    expect(request.headers.get('authorization')).toContain(
      'Credential=reader-access-key/'
    )
    expect(request.headers.get('authorization')).not.toContain(secret)
    expect(request.headers.get('x-amz-date')).toMatch(/^\d{8}T\d{6}Z$/u)
    expect(object.bytes).toEqual(bytes)
    expect(object.mediaType).toBe('application/json')
  })
})
