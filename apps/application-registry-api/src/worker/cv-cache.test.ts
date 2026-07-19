import { describe, expect, test } from 'bun:test'
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from '@cloudflare/workers-types'
import { Effect } from 'effect'

import { WorkerEnv } from './bindings'
import { CvCacheInvalidationError, invalidateCvCache } from './cv-cache'
import type { ApplicationRegistryEnv } from './types'

const environment = (
  overrides: Partial<ApplicationRegistryEnv>
): ApplicationRegistryEnv => ({
  APPLICATION_REGISTRY_DB: undefined as unknown as D1Database,
  CHATGPT_SESSIONS: undefined as unknown as KVNamespace,
  CLOUDFLARE_ANALYTICS_API_TOKEN: 'analytics-token',
  CLOUDFLARE_ZONE_ID: 'zone-id',
  CV_OBJECTS: undefined as unknown as R2Bucket,
  CV_WEB_HOST: 'cv.example.test',
  ...overrides,
})

describe('invalidateCvCache', () => {
  test('retries a transient Worker failure and sends the token purge', async () => {
    const bodies: unknown[] = []
    let attempts = 0
    const env = environment({
      CV_APP: {
        fetch: async (request) => {
          attempts += 1
          bodies.push(await request.json())
          return new Response(null, { status: attempts < 3 ? 503 : 200 })
        },
      },
      CV_REVALIDATION_SECRET: 'cache-secret',
    })

    await Effect.runPromise(
      invalidateCvCache({ token: 'cv-token' }).pipe(
        Effect.provideService(WorkerEnv, env)
      )
    )

    expect(attempts).toBe(3)
    expect(bodies).toEqual([
      { token: 'cv-token' },
      { token: 'cv-token' },
      { token: 'cv-token' },
    ])
  })

  test('fails closed when only half of the invalidation configuration exists', async () => {
    const error = await Effect.runPromise(
      invalidateCvCache({ all: true }).pipe(
        Effect.provideService(
          WorkerEnv,
          environment({ CV_REVALIDATION_SECRET: 'cache-secret' })
        ),
        Effect.flip
      )
    )

    expect(error).toBeInstanceOf(CvCacheInvalidationError)
    expect(error.message).toMatch(/requires both/u)
  })
})
