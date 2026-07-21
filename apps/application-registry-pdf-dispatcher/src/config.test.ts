import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect, Redacted } from 'effect'

import { readPdfDispatcherConfiguration } from './config'

const provider = ConfigProvider.layer(
  ConfigProvider.fromEnv({
    env: {
      NATS_PASSWORD: 'nats-password',
      NATS_USER: 'cv',
      POSTGRES_DATABASE: 'registry',
      POSTGRES_HOST: 'postgres',
      POSTGRES_PASSWORD: 'postgres-password',
      POSTGRES_USER: 'registry',
    },
  })
)

describe('PDF dispatcher configuration', () => {
  test('uses resource-conscious defaults', async () => {
    const configuration = await Effect.runPromise(
      readPdfDispatcherConfiguration.pipe(Effect.provide(provider))
    )

    expect(configuration.batchSize).toBe(25)
    expect(configuration.postgres.maxConnections).toBe(2)
    expect(configuration.nats.server).toBe('nats://127.0.0.1:4222')
    expect(Redacted.value(configuration.nats.password)).toBe('nats-password')
  })
})
