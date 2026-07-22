import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect, Redacted } from 'effect'

import { readRunnerConfiguration } from './config'

const required = {
  NATS_PASSWORD: 'nats-secret',
  NATS_USER: 'cv',
  POSTGRES_DATABASE: 'cv_registry',
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PASSWORD: 'secret',
  POSTGRES_USER: 'cv_listing_checker',
}

const readWith = (environment: Record<string, string>) =>
  readRunnerConfiguration.pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({ env: { ...required, ...environment } })
      )
    ),
    Effect.runPromise
  )

describe('listing-check runner configuration', () => {
  test('uses bounded production defaults and redacts the password', async () => {
    const configuration = await readWith({})

    expect(configuration.limit).toBe(5)
    expect(configuration.maxConnections).toBe(4)
    expect(configuration.mode).toBe('archive_eligible')
    expect(configuration.nats.server).toBe('nats://127.0.0.1:4222')
    expect(configuration.postgres.port).toBe(5432)
    expect(Redacted.value(configuration.postgres.password)).toBe('secret')
  })

  test('rejects invalid policy and resource bounds', async () => {
    await expect(
      readWith({ LISTING_CHECK_MODE: 'delete_everything' })
    ).rejects.toBeDefined()
    await expect(readWith({ LISTING_CHECK_BATCH_SIZE: '51' })).rejects.toThrow(
      'LISTING_CHECK_BATCH_SIZE'
    )
    await expect(readWith({ POSTGRES_MAX_CONNECTIONS: '0' })).rejects.toThrow(
      'POSTGRES_MAX_CONNECTIONS'
    )
  })
})
