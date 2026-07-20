import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'

import { readWranglerConfig } from './write-wrangler-config'

const requiredEnvironment = {
  APPLICATION_REGISTRY_DB_ID: 'registry-database-id',
  CHATGPT_SESSIONS_KV_ID: 'chatgpt-kv-id',
  CLOUDFLARE_ZONE_ID: 'zone-id',
  CV_WEB_HOST: 'cv.example.test',
}

const generateWith = (environment: Record<string, string> = {}) =>
  readWranglerConfig.pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({
          env: { ...requiredEnvironment, ...environment },
        })
      )
    ),
    Effect.runPromise
  )

describe('registry Wrangler config generation', () => {
  test('runs browser and machine API namespaces through the Worker', async () => {
    const config = await generateWith()

    expect(config.assets.run_worker_first).toEqual([
      '/api/*',
      '/machine',
      '/machine/*',
      '/health',
      '/openapi.json',
    ])
  })

  test('includes the CV_APP binding by default', async () => {
    const config = await generateWith({
      CV_PUBLIC_WORKER_NAME: 'cv-public-production',
    })

    expect(config.services).toEqual([
      {
        binding: 'CV_APP',
        service: 'cv-public-production',
      },
    ])
  })

  test('omits services during an explicit first-deploy bootstrap', async () => {
    const config = await generateWith({
      APPLICATION_REGISTRY_CV_APP_BINDING_ENABLED: 'false',
    })

    expect('services' in config).toBeFalse()
    expect(JSON.stringify(config)).not.toContain('"services"')
  })
})
