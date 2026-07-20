import { describe, expect, mock, test } from 'bun:test'
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from '@cloudflare/workers-types'
import {
  applicationRegistryOpenApi,
  HealthResponseSchema,
} from '@cv/application-registry-api-contract'
import { Schema } from 'effect'
import type {
  ApplicationRegistryEnv,
  WorkerExecutionContext,
} from './worker/types'

mock.module('cloudflare:workers', () => ({
  WorkerEntrypoint: class WorkerEntrypoint {},
  WorkflowEntrypoint: class WorkflowEntrypoint {},
}))

const { default: worker } = await import('./index')

const env = {
  // These routing tests never execute a registry persistence operation.
  APPLICATION_REGISTRY_DB: undefined as unknown as D1Database,
  CHATGPT_SESSIONS: undefined as unknown as KVNamespace,
  CLOUDFLARE_ANALYTICS_API_TOKEN: 'analytics-token',
  CLOUDFLARE_ZONE_ID: 'zone-id',
  CV_WEB_HOST: 'cv.example.test',
  CV_OBJECTS: undefined as unknown as R2Bucket,
  REGISTRY_API_TOKEN: 'test-token',
} satisfies ApplicationRegistryEnv
const context: WorkerExecutionContext = { waitUntil: () => undefined }

describe('application registry worker', () => {
  test('serves health without database access or authentication', async () => {
    const response = await worker.fetch(
      new Request('https://registry.example.test/health'),
      env,
      context
    )

    expect(response.status).toBe(200)
    expect(
      Schema.decodeUnknownSync(HealthResponseSchema)(await response.json())
    ).toEqual({ ok: true })
  })

  test('serves OpenAPI from the shared HttpApi declaration', async () => {
    const response = await worker.fetch(
      new Request('https://registry.example.test/openapi.json'),
      env,
      context
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(
      JSON.stringify(applicationRegistryOpenApi)
    )
  })

  test('routes browser registry requests through the same-origin BFF', async () => {
    const response = await worker.fetch(
      new Request('https://registry.example.test/api/registry/does-not-exist'),
      env,
      context
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  test('serves bearer-authenticated machine requests without BFF injection', async () => {
    const response = await worker.fetch(
      new Request('https://registry.example.test/machine/health', {
        headers: { authorization: 'Bearer test-token' },
      }),
      env,
      context
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await response.json()) as { readonly ok: boolean }).toEqual({
      ok: true,
    })
  })

  test('rejects machine requests that omit or present the wrong bearer token', async () => {
    const missing = await worker.fetch(
      new Request('https://registry.example.test/machine/health'),
      env,
      context
    )
    const invalid = await worker.fetch(
      new Request('https://registry.example.test/machine/health', {
        headers: { authorization: 'Bearer wrong-token' },
      }),
      env,
      context
    )

    expect(missing.status).toBe(401)
    expect(invalid.status).toBe(401)
    expect(missing.headers.get('cache-control')).toBe('private, no-store')
    expect(
      (await missing.json()) as {
        readonly code: string
        readonly message: string
      }
    ).toEqual({
      code: 'unauthorized',
      message: 'Missing or invalid registry API token.',
    })
  })

  test('fails closed when machine authentication is not configured', async () => {
    const response = await worker.fetch(
      new Request('https://registry.example.test/machine/health', {
        headers: { authorization: 'Bearer test-token' },
      }),
      { ...env, REGISTRY_API_TOKEN: undefined },
      context
    )

    expect(response.status).toBe(503)
    expect(
      (await response.json()) as {
        readonly code: string
        readonly message: string
      }
    ).toEqual({
      code: 'service_unavailable',
      message: 'Registry API token is not configured.',
    })
  })

  test('does not serve management assets through the machine namespace', async () => {
    const ASSETS = {
      fetch: () => Promise.resolve(new Response('management asset')),
    }
    const response = await worker.fetch(
      new Request('https://registry.example.test/machine/not-an-api', {
        headers: { authorization: 'Bearer test-token' },
      }),
      { ...env, ASSETS },
      context
    )

    expect(response.status).toBe(404)
  })

  test('fails closed when browser BFF authentication is not configured', async () => {
    const response = await worker.fetch(
      new Request('https://registry.example.test/api/registry/health'),
      { ...env, REGISTRY_API_TOKEN: undefined },
      context
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(
      Schema.decodeUnknownSync(
        Schema.Struct({ code: Schema.String, message: Schema.String })
      )(await response.json())
    ).toEqual({
      code: 'service_unavailable',
      message: 'Registry BFF authentication is not configured.',
    })
  })

  test('fails closed when the browser BFF token is blank', async () => {
    const response = await worker.fetch(
      new Request('https://registry.example.test/api/registry/health'),
      { ...env, REGISTRY_API_TOKEN: '   ' },
      context
    )

    expect(response.status).toBe(503)
    expect(
      Schema.decodeUnknownSync(
        Schema.Struct({ code: Schema.String, message: Schema.String })
      )(await response.json())
    ).toEqual({
      code: 'service_unavailable',
      message: 'Registry BFF authentication is not configured.',
    })
  })

  test('serves management SPA assets outside API routes', async () => {
    const ASSETS = {
      fetch: (request: Request) =>
        Promise.resolve(
          new Response(`management asset: ${new URL(request.url).pathname}`)
        ),
    }
    const response = await worker.fetch(
      new Request('https://registry.example.test/applications/example'),
      { ...env, ASSETS },
      context
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(
      'management asset: /applications/example'
    )
  })

  test('lets the generated router reject unknown paths and methods', async () => {
    const missing = await worker.fetch(
      new Request('https://registry.example.test/nope'),
      env,
      context
    )
    const wrongMethod = await worker.fetch(
      new Request('https://registry.example.test/api/registry/applications', {
        method: 'PATCH',
      }),
      env,
      context
    )

    expect(missing.status).toBe(404)
    expect(wrongMethod.status).toBe(404)
  })
})
