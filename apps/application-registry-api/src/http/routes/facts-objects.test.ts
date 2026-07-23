import { describe, expect, test } from 'bun:test'
import { Effect, Redacted } from 'effect'

import { FactsStorage } from '../../facts/storage'
import { makeFactsObjectRequestHandler } from './facts-objects'

const factsStorage = FactsStorage.of({
  get: (key) =>
    Effect.succeed(
      key === 'releases/current.json'
        ? {
            bytes: new TextEncoder().encode('{"ok":true}'),
            cacheControl: 'private, no-cache',
            etag: 'etag',
            mediaType: 'application/json',
            responseEtag: '"etag"',
            sha256: 'a'.repeat(64),
            size: 11,
          }
        : null
    ),
  head: () => Effect.succeed(null),
  put: () => Effect.succeed(true),
})

const handler = makeFactsObjectRequestHandler(
  factsStorage,
  Redacted.make('registry-token')
)

describe('authenticated facts object route', () => {
  test('rejects an invalid bearer token before reading private facts', async () => {
    const response = await handler(
      new Request(
        'https://registry.test/api/registry/facts/objects/releases/current.json',
        { headers: { authorization: 'Bearer wrong' } }
      )
    )

    expect(response.status).toBe(401)
  })

  test('reports unavailable authentication when the registry token is blank', async () => {
    const unavailableHandler = makeFactsObjectRequestHandler(
      factsStorage,
      Redacted.make('   ')
    )
    const response = await unavailableHandler(
      new Request(
        'https://registry.test/api/registry/facts/objects/releases/current.json',
        { headers: { authorization: 'Bearer registry-token' } }
      )
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      code: 'service_unavailable',
      message: 'Registry API token is not configured.',
    })
  })

  test('serves private facts objects on the canonical API', async () => {
    const response = await handler(
      new Request(
        'https://registry.test/api/registry/facts/objects/releases/current.json',
        { headers: { authorization: 'Bearer registry-token' } }
      )
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"ok":true}')
    expect(response.headers.get('x-cv-facts-sha256')).toBe('a'.repeat(64))
  })
})
