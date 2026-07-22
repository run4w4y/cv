import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'

import { readPdfWorkerConfiguration } from './config'

const provider = ConfigProvider.layer(
  ConfigProvider.fromEnv({
    env: {
      MINIO_ACCESS_KEY_ID: 'cv-registry',
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_OBJECTS_BUCKET: 'cv-objects',
      MINIO_SECRET_ACCESS_KEY: 'secret',
      NATS_PASSWORD: 'nats-password',
      NATS_USER: 'cv',
      POSTGRES_DATABASE: 'registry',
      POSTGRES_HOST: 'postgres',
      POSTGRES_PASSWORD: 'postgres-password',
      POSTGRES_USER: 'registry',
    },
  })
)

describe('PDF worker configuration', () => {
  test('uses single-worker resource defaults', async () => {
    const configuration = await Effect.runPromise(
      readPdfWorkerConfiguration.pipe(Effect.provide(provider))
    )

    expect(configuration.heartbeatMilliseconds).toBe(30_000)
    expect(configuration.postgres.maxConnections).toBe(3)
    expect(configuration.minio.forcePathStyle).toBe(true)
  })
})
