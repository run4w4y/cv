import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect, Option } from 'effect'
import {
  readApplicationRegistryClientConfig,
  readOptionalApplicationRegistryClientConfig,
} from './config'

const withEnv = <A, E>(
  effect: Effect.Effect<A, E>,
  env: Record<string, string>
) =>
  effect.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
  )

describe('application registry client config', () => {
  test('is optional when URL and token are both absent', async () => {
    const config = await Effect.runPromise(
      withEnv(readOptionalApplicationRegistryClientConfig, {})
    )
    expect(Option.isNone(config)).toBeTrue()
  })

  test('rejects partial registry configuration', async () => {
    await expect(
      Effect.runPromise(
        withEnv(readOptionalApplicationRegistryClientConfig, {
          REGISTRY_API_URL: 'https://registry.example.test',
        })
      )
    ).rejects.toThrow('missing REGISTRY_API_TOKEN')
  })

  test('loads complete configuration and defaults the outbox', async () => {
    const config = await Effect.runPromise(
      withEnv(readApplicationRegistryClientConfig, {
        REGISTRY_API_TOKEN: 'token',
        REGISTRY_API_URL: 'https://registry.example.test',
        REGISTRY_DEVICE_ID: 'laptop',
      })
    )
    expect(config.apiUrl.href).toBe('https://registry.example.test/')
    expect(config.deviceId).toBe('laptop')
    expect(config.outboxDirectory).toEndWith(
      '/.cv-work/application-registry/outbox'
    )
  })
})
