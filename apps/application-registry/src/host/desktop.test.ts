import { afterEach, describe, expect, mock, test } from 'bun:test'
import type {
  DesktopFetchRequest,
  DesktopHostBridge,
} from '@cv/application-registry-desktop-contract'
import { Effect } from 'effect'
import { HttpClient } from 'effect/unstable/http'

import { hostHttpClientLayer } from '../lib/registry-client'
import { hostFetch } from './desktop'

const originalFetch = globalThis.fetch
const unavailable = {
  error: {
    code: 'network_failed' as const,
    message: 'Unavailable in this test.',
  },
  ok: false as const,
}

const installBridge = (networkFetch: DesktopHostBridge['network']['fetch']) => {
  const bridge: DesktopHostBridge = {
    codex: {
      cancel: async () => ({ ok: true, value: undefined }),
      generate: async () => unavailable,
      status: async () => unavailable,
    },
    network: { fetch: networkFetch },
    registry: {
      configure: async () => unavailable,
      status: async () => unavailable,
    },
  }
  Object.defineProperty(window, 'cvDesktop', {
    configurable: true,
    value: bridge,
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
  Object.defineProperty(window, 'cvDesktop', {
    configurable: true,
    value: undefined,
  })
})

describe('desktop host fetch', () => {
  test('serializes custom-scheme Registry URL objects as relative bridge requests', async () => {
    const requests: Array<DesktopFetchRequest> = []
    installBridge(async (request) => {
      requests.push(request)
      return {
        ok: true,
        value: {
          body: new TextEncoder().encode('{"updated":true}'),
          headers: [['content-type', 'application/json']],
          status: 200,
          statusText: 'OK',
        },
      }
    })

    const response = await hostFetch(
      new URL('cv-registry://app/api/registry/applications/app-1?view=full'),
      {
        body: '{"status":"interviewing"}',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      }
    )

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('/api/registry/applications/app-1?view=full')
    expect(requests[0]?.method).toBe('PATCH')
    expect(new TextDecoder().decode(requests[0]?.body ?? undefined)).toBe(
      '{"status":"interviewing"}'
    )
    expect(await response.json()).toEqual({ updated: true })
  })

  test('carries an Effect HTTP request through the desktop bridge', async () => {
    const requests: Array<DesktopFetchRequest> = []
    installBridge(async (request) => {
      requests.push(request)
      return {
        ok: true,
        value: {
          body: new TextEncoder().encode('{"ok":true}'),
          headers: [['content-type', 'application/json']],
          status: 200,
          statusText: 'OK',
        },
      }
    })

    const body = await Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const response = yield* client.get(
        'cv-registry://app/api/registry/health'
      )
      return yield* response.text
    }).pipe(Effect.provide(hostHttpClientLayer), Effect.runPromise)

    expect(body).toBe('{"ok":true}')
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('/api/registry/health')
  })

  test('leaves non-Registry requests on the renderer fetch path', async () => {
    const bridgeFetch = mock(async () => unavailable)
    const browserFetch = mock(async () => Response.json({ amount: 100 }))
    installBridge(bridgeFetch)
    globalThis.fetch = browserFetch as unknown as typeof fetch

    const response = await hostFetch(
      'https://api.frankfurter.app/v1/latest?base=EUR'
    )

    expect(await response.json()).toEqual({ amount: 100 })
    expect(browserFetch).toHaveBeenCalledTimes(1)
    expect(bridgeFetch).not.toHaveBeenCalled()
  })
})
