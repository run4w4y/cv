import { describe, expect, test } from 'bun:test'
import { Effect, Redacted } from 'effect'
import type { ApiServerConfiguration } from './config'
import { FactsStorage } from './facts/storage'
import { makeApiServerRequestHandler } from './request-handler'

const configuration = (bffEnabled = false): ApiServerConfiguration => ({
  analytics: {
    apiToken: Redacted.make('analytics-token'),
    endpoint: new URL('https://cloudflare.test/graphql'),
    host: 'cv.example.test',
    zoneId: 'zone-id',
  },
  authentication: {
    bffEnabled,
    factsPublishToken: Redacted.make('facts-token'),
    registryApiToken: Redacted.make('registry-token'),
  },
  cacheInvalidation: { secret: undefined, url: undefined },
  http: {
    host: '127.0.0.1',
    port: 3000,
    staticAssetsDirectory: '/missing',
  },
  minio: {
    accessKeyId: Redacted.make('access'),
    endpoint: new URL('http://127.0.0.1:9000'),
    factsBucket: 'facts',
    forcePathStyle: true,
    objectsBucket: 'objects',
    region: 'test',
    secretAccessKey: Redacted.make('secret'),
  },
  nats: {
    password: Redacted.make('secret'),
    server: 'nats://127.0.0.1:4222',
    username: 'registry',
  },
  postgres: {
    database: 'registry',
    host: '127.0.0.1',
    maxConnections: 2,
    password: Redacted.make('secret'),
    port: 5432,
    username: 'registry',
  },
})

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

const makeHandler = (bffEnabled = false, requests: Request[] = []) =>
  makeApiServerRequestHandler({
    apiHandler: (request) => {
      requests.push(request)
      return Promise.resolve(
        Response.json({ path: new URL(request.url).pathname })
      )
    },
    configuration: configuration(bffEnabled),
    factsStorage,
  })

describe('application registry API server request boundary', () => {
  test('rejects an invalid machine token before the API router', async () => {
    const requests: Request[] = []
    const response = await makeHandler(
      false,
      requests
    )(
      new Request('https://registry.test/machine/api/registry/applications', {
        headers: { authorization: 'Bearer wrong' },
      })
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(requests).toHaveLength(0)
  })

  test('authenticates and rewrites the machine transport', async () => {
    const requests: Request[] = []
    const response = await makeHandler(
      false,
      requests
    )(
      new Request('https://registry.test/machine/api/registry/applications', {
        headers: { authorization: 'Bearer registry-token' },
      })
    )

    expect(response.status).toBe(200)
    expect(new URL(requests[0]?.url ?? '').pathname).toBe(
      '/api/registry/applications'
    )
  })

  test('keeps same-origin BFF injection disabled by default', async () => {
    const requests: Request[] = []
    const response = await makeHandler(
      false,
      requests
    )(new Request('https://registry.test/api/registry/applications'))

    expect(response.status).toBe(401)
    expect(requests).toHaveLength(0)
  })

  test('injects the BFF token only when explicitly enabled', async () => {
    const requests: Request[] = []
    const response = await makeHandler(
      true,
      requests
    )(new Request('https://registry.test/api/registry/applications'))

    expect(response.status).toBe(200)
    expect(requests[0]?.headers.get('authorization')).toBe(
      'Bearer registry-token'
    )
  })

  test('serves private facts objects only through an authenticated transport', async () => {
    const requests: Request[] = []
    const response = await makeHandler(
      false,
      requests
    )(
      new Request(
        'https://registry.test/machine/api/registry/facts/objects/releases/current.json',
        { headers: { authorization: 'Bearer registry-token' } }
      )
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"ok":true}')
    expect(response.headers.get('x-cv-facts-sha256')).toBe('a'.repeat(64))
    expect(requests).toHaveLength(0)
  })
})
