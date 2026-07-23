import { describe, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import * as NodeHttpClient from '@effect/platform-node/NodeHttpClient'
import { Effect, Layer, Redacted } from 'effect'
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from 'effect/unstable/http'

import {
  DesktopNetwork,
  desktopNetworkLayer,
  isRegistryDesktopRequest,
} from './network'
import { DesktopSettings } from './settings'

const settingsLayer = (origin = 'https://registry.example.test') =>
  Layer.succeed(
    DesktopSettings,
    DesktopSettings.of({
      read: Effect.succeed({
        origin,
        source: 'stored',
        token: Redacted.make('machine-token'),
      }),
      resolveUpdate: (input) =>
        Effect.succeed({
          origin: input.origin,
          token: Redacted.make(input.token ?? 'machine-token'),
        }),
      status: Effect.succeed({
        configured: true,
        editable: true,
        origin,
        source: 'stored',
      }),
      write: (credentials) =>
        Effect.succeed({
          configured: true,
          editable: true,
          origin: credentials.origin,
          source: 'stored',
        }),
    })
  )

const responseClient = (
  onRequest: (request: HttpClientRequest.HttpClientRequest) => void
) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => {
      onRequest(request)
      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify({ ok: true }), {
            headers: { 'content-type': 'application/json' },
            status: 201,
            statusText: 'Created',
          })
        )
      )
    })
  )

describe('desktop Registry network bridge', () => {
  test('recognizes only the Registry API namespace', () => {
    expect(isRegistryDesktopRequest('/api/registry')).toBe(true)
    expect(isRegistryDesktopRequest('/api/registry/applications')).toBe(true)
    expect(isRegistryDesktopRequest('/api/registry-other')).toBe(false)
    expect(isRegistryDesktopRequest('https://frankfurter.app/latest')).toBe(
      false
    )
  })

  test('routes Registry requests to the configured origin and owns authorization', async () => {
    const requests: Array<HttpClientRequest.HttpClientRequest> = []
    const layer = desktopNetworkLayer().pipe(
      Layer.provide(
        Layer.merge(
          settingsLayer(),
          responseClient((request) => {
            requests.push(request)
          })
        )
      )
    )

    const result = await Effect.gen(function* () {
      const network = yield* DesktopNetwork
      return yield* network.fetch({
        body: new TextEncoder().encode('{"status":"interviewing"}'),
        headers: [
          ['Authorization', 'Bearer attacker-controlled'],
          ['content-type', 'application/json'],
        ],
        method: 'PATCH',
        url: '/api/registry/applications/app-1?include=compensation',
      })
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe(
      'https://registry.example.test/api/registry/applications/app-1?include=compensation'
    )
    expect(requests[0]?.headers.authorization).toBe('Bearer machine-token')
    expect(result.status).toBe(201)
    expect(new TextDecoder().decode(result.body)).toBe('{"ok":true}')
  })

  test('rejects non-Registry traffic before reading credentials or using the client', async () => {
    let requests = 0
    const layer = desktopNetworkLayer().pipe(
      Layer.provide(
        Layer.merge(
          settingsLayer(),
          responseClient((_request) => {
            requests += 1
          })
        )
      )
    )

    const error = await Effect.gen(function* () {
      const network = yield* DesktopNetwork
      return yield* network.fetch({
        body: null,
        headers: [],
        method: 'GET',
        url: 'https://api.frankfurter.app/latest',
      })
    }).pipe(Effect.provide(layer), Effect.flip, Effect.runPromise)

    expect(error).toMatchObject({ code: 'invalid_request' })
    expect(requests).toBe(0)
  })

  test('rejects paths that leave the Registry namespace after URL normalization', async () => {
    let requests = 0
    const layer = desktopNetworkLayer().pipe(
      Layer.provide(
        Layer.merge(
          settingsLayer(),
          responseClient((_request) => {
            requests += 1
          })
        )
      )
    )

    const errors = await Effect.forEach(
      [
        '/api/registry/../outside',
        '/api/registry/%2e%2e/outside',
        '/api/registry/%2E%2E%2Foutside',
      ],
      (url) =>
        Effect.gen(function* () {
          const network = yield* DesktopNetwork
          return yield* network.fetch({
            body: null,
            headers: [],
            method: 'GET',
            url,
          })
        }).pipe(Effect.flip),
      { concurrency: 1 }
    ).pipe(Effect.provide(layer), Effect.runPromise)

    expect(errors.every((error) => error.code === 'invalid_request')).toBe(true)
    expect(requests).toBe(0)
  })

  test('canonicalizes a relative Registry URL through the real HTTP transport', async () => {
    const received: Array<{
      readonly authorization: string | undefined
      readonly url: string | undefined
    }> = []
    const server = createServer((request, response) => {
      received.push({
        authorization: request.headers.authorization,
        url: request.url,
      })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{"transport":"real"}')
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })

    try {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        throw new Error('Expected a local TCP server address.')
      }
      const origin = `http://127.0.0.1:${address.port}`
      const layer = desktopNetworkLayer({ requestTimeout: '2 seconds' }).pipe(
        Layer.provide(
          Layer.merge(
            settingsLayer(`${origin}/ignored/base/path`),
            NodeHttpClient.layerNodeHttp
          )
        )
      )

      const result = await Effect.gen(function* () {
        const network = yield* DesktopNetwork
        return yield* network.fetch({
          body: null,
          headers: [],
          method: 'GET',
          url: '/api/registry/applications?size=25',
        })
      }).pipe(Effect.provide(layer), Effect.runPromise)

      expect(received).toEqual([
        {
          authorization: 'Bearer machine-token',
          url: '/api/registry/applications?size=25',
        },
      ])
      expect(new TextDecoder().decode(result.body)).toBe('{"transport":"real"}')
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
    }
  })

  test('times out a stalled response body through the real HTTP transport', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.write('{"partial":')
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })

    try {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        throw new Error('Expected a local TCP server address.')
      }
      const origin = `http://127.0.0.1:${address.port}`
      const layer = desktopNetworkLayer({
        requestTimeout: '500 millis',
      }).pipe(
        Layer.provide(
          Layer.merge(settingsLayer(origin), NodeHttpClient.layerNodeHttp)
        )
      )

      const error = await Effect.gen(function* () {
        const network = yield* DesktopNetwork
        return yield* network.fetch({
          body: null,
          headers: [],
          method: 'GET',
          url: '/api/registry/applications',
        })
      }).pipe(Effect.provide(layer), Effect.flip, Effect.runPromise)

      expect(error).toMatchObject({
        code: 'network_failed',
        message: 'The network request failed.',
      })
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
    }
  })
})
