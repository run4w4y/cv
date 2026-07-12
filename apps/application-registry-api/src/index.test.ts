import { describe, expect, test } from 'bun:test'
import type { D1Database } from '@cloudflare/workers-types'
import {
  applicationRegistryOpenApi,
  HealthResponseSchema,
} from '@cv/application-registry-api-contract'
import { Schema } from 'effect'
import worker from './index'
import type {
  ApplicationRegistryEnv,
  WorkerExecutionContext,
} from './worker/types'

const env = {
  // These routing tests never execute a registry persistence operation.
  APPLICATION_REGISTRY_DB: undefined as unknown as D1Database,
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

  test('lets the generated router reject unknown paths and methods', async () => {
    const missing = await worker.fetch(
      new Request('https://registry.example.test/nope'),
      env,
      context
    )
    const wrongMethod = await worker.fetch(
      new Request('https://registry.example.test/v1/applications', {
        method: 'POST',
      }),
      env,
      context
    )

    expect(missing.status).toBe(404)
    expect(wrongMethod.status).toBe(404)
  })
})
