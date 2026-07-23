import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect, Redacted } from 'effect'

import {
  ApplicationRegistryMcpConfigError,
  readApplicationRegistryMcpConfig,
} from './config'

const withEnv = (env: Record<string, string>) =>
  readApplicationRegistryMcpConfig.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
  )

describe('application registry MCP config', () => {
  test('loads the registry origin and bearer token', async () => {
    const config = await Effect.runPromise(
      withEnv({
        REGISTRY_API_TOKEN: 'test-token',
        REGISTRY_API_URL: 'https://registry.example.test',
      })
    )

    expect(config.apiUrl.href).toBe('https://registry.example.test/')
    expect(Redacted.value(config.token)).toBe('test-token')
  })

  test('fails with a typed, secret-safe error when configuration is missing', async () => {
    const error = await Effect.runPromise(withEnv({}).pipe(Effect.flip))

    expect(error).toBeInstanceOf(ApplicationRegistryMcpConfigError)
    expect(error.message).toContain('REGISTRY_API_URL')
    expect(error.message).toContain('REGISTRY_API_TOKEN')
  })

  test('does not include the configured token in configuration failures', async () => {
    const token = 'secret-that-must-stay-redacted'
    const error = await Effect.runPromise(
      withEnv({
        REGISTRY_API_TOKEN: token,
        REGISTRY_API_URL: 'not-a-url',
      }).pipe(Effect.flip)
    )

    expect(error.message).not.toContain(token)
  })
})
