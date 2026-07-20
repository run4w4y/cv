import { describe, expect, test } from 'bun:test'
import { type Config, ConfigProvider, Effect } from 'effect'

import {
  applicationRegistryCvAppBindingEnabled,
  applicationRegistryWorkersDevEnabled,
} from './deployment-config'

const readWith = <A>(config: Config.Config<A>, env: Record<string, string>) =>
  config.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
    Effect.runPromise
  )

describe('registry deployment configuration', () => {
  test('keeps workers.dev disabled until Terraform explicitly enables it', async () => {
    await expect(
      readWith(applicationRegistryWorkersDevEnabled, {})
    ).resolves.toBeFalse()
  })

  test('preserves Terraform-enabled workers.dev exposure on later deploys', async () => {
    await expect(
      readWith(applicationRegistryWorkersDevEnabled, {
        APPLICATION_REGISTRY_WORKERS_DEV_ENABLED: 'true',
      })
    ).resolves.toBeTrue()
  })

  test('rejects invalid exposure values', async () => {
    await expect(
      readWith(applicationRegistryWorkersDevEnabled, {
        APPLICATION_REGISTRY_WORKERS_DEV_ENABLED: 'sometimes',
      })
    ).rejects.toThrow()
  })

  test('enables the CV_APP binding for ordinary deployments', async () => {
    await expect(
      readWith(applicationRegistryCvAppBindingEnabled, {})
    ).resolves.toBeTrue()
  })

  test('allows an explicit first-deploy bootstrap to omit CV_APP', async () => {
    await expect(
      readWith(applicationRegistryCvAppBindingEnabled, {
        APPLICATION_REGISTRY_CV_APP_BINDING_ENABLED: 'false',
      })
    ).resolves.toBeFalse()
  })

  test('rejects invalid CV_APP binding values', async () => {
    await expect(
      readWith(applicationRegistryCvAppBindingEnabled, {
        APPLICATION_REGISTRY_CV_APP_BINDING_ENABLED: 'sometimes',
      })
    ).rejects.toThrow()
  })
})
