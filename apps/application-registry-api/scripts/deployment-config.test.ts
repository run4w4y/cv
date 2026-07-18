import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'

import { applicationRegistryWorkersDevEnabled } from './deployment-config'

const readWith = (env: Record<string, string>) =>
  applicationRegistryWorkersDevEnabled.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
    Effect.runPromise
  )

describe('registry deployment configuration', () => {
  test('keeps workers.dev disabled until Terraform explicitly enables it', async () => {
    await expect(readWith({})).resolves.toBeFalse()
  })

  test('preserves Terraform-enabled workers.dev exposure on later deploys', async () => {
    await expect(
      readWith({ APPLICATION_REGISTRY_WORKERS_DEV_ENABLED: 'true' })
    ).resolves.toBeTrue()
  })

  test('rejects invalid exposure values', async () => {
    await expect(
      readWith({ APPLICATION_REGISTRY_WORKERS_DEV_ENABLED: 'sometimes' })
    ).rejects.toThrow()
  })
})
