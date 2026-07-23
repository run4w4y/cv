import { describe, expect, test } from 'bun:test'
import { Effect, Layer, Redacted } from 'effect'
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from 'effect/unstable/http'

import {
  DesktopRegistryConnection,
  desktopRegistryConnectionLayer,
} from './registry-connection'
import { DesktopSettings } from './settings'

const settingsLayer = (onWrite: () => void = () => undefined) =>
  Layer.succeed(
    DesktopSettings,
    DesktopSettings.of({
      read: Effect.succeed(null),
      resolveUpdate: (input) =>
        Effect.succeed({
          origin: new URL(input.origin).origin,
          token: Redacted.make(input.token ?? ''),
        }),
      status: Effect.succeed({
        configured: false,
        editable: true,
        origin: null,
        source: 'unconfigured',
      }),
      write: (credentials) => {
        onWrite()
        return Effect.succeed({
          configured: true,
          editable: true,
          origin: credentials.origin,
          source: 'stored',
        })
      },
    })
  )

const responseClient = (
  response: Response,
  onRequest: (request: HttpClientRequest.HttpClientRequest) => void = () =>
    undefined
) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => {
      onRequest(request)
      return Effect.succeed(HttpClientResponse.fromWeb(request, response))
    })
  )

describe('desktop Registry configuration', () => {
  test('verifies the bearer token before storing it', async () => {
    const requests: Array<HttpClientRequest.HttpClientRequest> = []
    let writes = 0
    const layer = desktopRegistryConnectionLayer().pipe(
      Layer.provide(
        Layer.merge(
          settingsLayer(() => {
            writes += 1
          }),
          responseClient(
            new Response(JSON.stringify({ ok: true }), {
              headers: { 'content-type': 'application/json' },
              status: 200,
            }),
            (value) => {
              requests.push(value)
            }
          )
        )
      )
    )

    const result = await Effect.gen(function* () {
      const connection = yield* DesktopRegistryConnection
      return yield* connection.configure({
        origin: 'https://registry.example.test/path',
        token: 'machine-token',
      })
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(result).toMatchObject({ configured: true, source: 'stored' })
    expect(requests[0]?.url).toBe(
      'https://registry.example.test/api/registry/health'
    )
    expect(requests[0]?.headers.authorization).toBe('Bearer machine-token')
    expect(writes).toBe(1)
  })

  test('does not store a token rejected by the API', async () => {
    let writes = 0
    const layer = desktopRegistryConnectionLayer().pipe(
      Layer.provide(
        Layer.merge(
          settingsLayer(() => {
            writes += 1
          }),
          responseClient(new Response(null, { status: 401 }))
        )
      )
    )

    const error = await Effect.gen(function* () {
      const connection = yield* DesktopRegistryConnection
      return yield* connection.configure({
        origin: 'https://registry.example.test',
        token: 'wrong-token',
      })
    }).pipe(Effect.provide(layer), Effect.flip, Effect.runPromise)

    expect(error).toMatchObject({ code: 'registry_unauthorized' })
    expect(writes).toBe(0)
  })

  test('times out while a successful health response body is still stalled', async () => {
    let writes = 0
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":'))
      },
    })
    const layer = desktopRegistryConnectionLayer({
      verificationTimeout: '50 millis',
    }).pipe(
      Layer.provide(
        Layer.merge(
          settingsLayer(() => {
            writes += 1
          }),
          responseClient(
            new Response(body, {
              headers: { 'content-type': 'application/json' },
              status: 200,
            })
          )
        )
      )
    )

    const error = await Effect.gen(function* () {
      const connection = yield* DesktopRegistryConnection
      return yield* connection.configure({
        origin: 'https://registry.example.test',
        token: 'machine-token',
      })
    }).pipe(Effect.provide(layer), Effect.flip, Effect.runPromise)

    expect(error).toMatchObject({
      code: 'network_failed',
      message: 'The Registry API could not be reached.',
    })
    expect(writes).toBe(0)
  })
})
