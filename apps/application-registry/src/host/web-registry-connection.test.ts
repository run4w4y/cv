import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  createWebRegistryConnection,
  WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
  WEB_REGISTRY_CONNECTION_STORAGE_KEY,
} from './web-registry-connection'

const requestFrom = (input: RequestInfo | URL, init?: RequestInit) =>
  input instanceof Request ? input : new Request(input, init)

afterEach(() => {
  window.localStorage.clear()
})

beforeEach(() => {
  window.localStorage.clear()
})

describe('web Registry connection', () => {
  test('starts unconfigured without a bundled bearer token', async () => {
    const fetcher = mock(async () => Response.json({ applications: [] }))
    const connection = createWebRegistryConnection({
      environment: {},
      fetch: fetcher,
      hostOrigin: 'https://management.example.test',
      storage: window.localStorage,
    })

    expect(connection.current()).toEqual({
      configured: false,
      editable: true,
      origin: 'https://cv-api.4w4y.run',
      resettable: false,
      source: 'default',
      tokenConfigured: false,
    })

    await expect(
      connection.fetch('/api/registry/applications')
    ).rejects.toThrow('The Registry API connection is not configured.')
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('tests, stores, and routes a browser override', async () => {
    const fetcher = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = requestFrom(input, init)
        return request.url.endsWith('/api/registry/health')
          ? Response.json({ ok: true })
          : Response.json({ applications: [] })
      }
    )
    const connection = createWebRegistryConnection({
      environment: {},
      fetch: fetcher,
      hostOrigin: 'https://management.example.test',
      storage: window.localStorage,
    })

    const configured = await connection.configure({
      origin: '  https://registry.example.test/some-path  ',
      token: '  bearer-token  ',
    })

    expect(configured).toEqual({
      configured: true,
      editable: true,
      origin: 'https://registry.example.test',
      resettable: true,
      source: 'override',
      tokenConfigured: true,
    })
    expect(
      JSON.parse(
        window.localStorage.getItem(WEB_REGISTRY_CONNECTION_STORAGE_KEY) ?? ''
      )
    ).toEqual({
      origin: 'https://registry.example.test',
      schemaVersion: WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
      token: 'bearer-token',
    })

    await connection.fetch('/api/registry/applications?size=25', {
      headers: { 'x-request-id': 'request-1' },
    })

    const routed = requestFrom(
      fetcher.mock.calls[1]?.[0] as RequestInfo | URL,
      fetcher.mock.calls[1]?.[1]
    )
    expect(routed.url).toBe(
      'https://registry.example.test/api/registry/applications?size=25'
    )
    expect(routed.headers.get('authorization')).toBe('Bearer bearer-token')
    expect(routed.headers.get('x-request-id')).toBe('request-1')
  })

  test('uses build defaults until a stored override replaces them', async () => {
    window.localStorage.setItem(
      WEB_REGISTRY_CONNECTION_STORAGE_KEY,
      JSON.stringify({
        origin: 'https://override.example.test',
        schemaVersion: WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
        token: 'override-token',
      })
    )
    const connection = createWebRegistryConnection({
      environment: {
        VITE_REGISTRY_API_URL: 'https://default.example.test',
      },
      fetch: async () => Response.json({ ok: true }),
      hostOrigin: 'https://management.example.test',
      storage: window.localStorage,
    })

    expect(connection.current()?.origin).toBe('https://override.example.test')
    expect(connection.current()?.source).toBe('override')

    const restored = await connection.reset()

    expect(restored.origin).toBe('https://default.example.test')
    expect(restored.source).toBe('default')
    expect(restored.configured).toBe(false)
    expect(restored.tokenConfigured).toBe(false)
    expect(
      window.localStorage.getItem(WEB_REGISTRY_CONNECTION_STORAGE_KEY)
    ).toBeNull()
  })

  test('ignores malformed stored configuration and rejects an invalid URL', async () => {
    window.localStorage.setItem(
      WEB_REGISTRY_CONNECTION_STORAGE_KEY,
      JSON.stringify({
        origin: 'not a url',
        schemaVersion: WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
        token: 'bearer-token',
      })
    )
    const fetcher = mock(async () => Response.json({ ok: true }))
    const connection = createWebRegistryConnection({
      environment: {},
      fetch: fetcher,
      hostOrigin: 'https://management.example.test',
      storage: window.localStorage,
    })

    expect(connection.current()?.source).toBe('default')
    await expect(
      connection.configure({
        origin: 'still not a url',
        token: 'bearer-token',
      })
    ).rejects.toThrow('Enter a valid Registry API URL.')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
