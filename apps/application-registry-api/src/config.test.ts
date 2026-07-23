import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect, Redacted } from 'effect'

import { readApiServerConfiguration } from './config'

const required = {
  CLOUDFLARE_ANALYTICS_API_TOKEN: 'analytics-token',
  CLOUDFLARE_ZONE_ID: 'zone-id',
  CV_WEB_HOST: 'cv.example.test',
  FACTS_PUBLISH_TOKEN: 'facts-token',
  MINIO_ACCESS_KEY_ID: 'minio-access',
  MINIO_ENDPOINT: 'http://127.0.0.1:9000',
  MINIO_FACTS_BUCKET: 'cv-facts',
  MINIO_OBJECTS_BUCKET: 'cv-objects',
  MINIO_SECRET_ACCESS_KEY: 'minio-secret',
  NATS_PASSWORD: 'nats-password',
  NATS_USER: 'cv',
  POSTGRES_DATABASE: 'cv_registry',
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PASSWORD: 'postgres-secret',
  POSTGRES_USER: 'cv_registry',
  REGISTRY_API_TOKEN: 'registry-token',
}

const readWith = (environment: Record<string, string>) =>
  readApiServerConfiguration.pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({ env: { ...required, ...environment } })
      )
    ),
    Effect.runPromise
  )

describe('application registry API server configuration', () => {
  test('uses safe resource and exposure defaults', async () => {
    const configuration = await readWith({})

    expect(configuration.cors.allowedOrigins).toEqual([
      'http://localhost:4300',
      'http://127.0.0.1:4300',
    ])
    expect(configuration.http.host).toBe('0.0.0.0')
    expect(configuration.http.port).toBe(3000)
    expect(configuration.minio.forcePathStyle).toBe(true)
    expect(configuration.nats.server).toBe('nats://127.0.0.1:4222')
    expect(configuration.postgres.maxConnections).toBe(6)
    expect(Redacted.value(configuration.postgres.password)).toBe(
      'postgres-secret'
    )
  })

  test('uses the Cloudflare API cache-purge endpoint by default', async () => {
    const configuration = await readWith({})

    expect(configuration.cacheInvalidation.endpoint.toString()).toBe(
      'https://api.cloudflare.com/client/v4/'
    )
  })

  test('rejects malformed URLs and excessive PostgreSQL pools', async () => {
    await expect(readWith({ MINIO_ENDPOINT: 'not-a-url' })).rejects.toThrow(
      'MINIO_ENDPOINT'
    )
    await expect(readWith({ POSTGRES_MAX_CONNECTIONS: '21' })).rejects.toThrow(
      'POSTGRES_MAX_CONNECTIONS'
    )
    await expect(
      readWith({
        REGISTRY_CORS_ALLOWED_ORIGINS: 'https://cv-registry.example.test/path',
      })
    ).rejects.toThrow('REGISTRY_CORS_ALLOWED_ORIGINS')
  })
})
