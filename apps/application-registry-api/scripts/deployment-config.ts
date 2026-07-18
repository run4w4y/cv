import { Config } from 'effect'

export const applicationRegistryWorkersDevEnabledEnv =
  'APPLICATION_REGISTRY_WORKERS_DEV_ENABLED'

/**
 * The registry's public hostname is Terraform/Access owned. A fresh Worker
 * deployment therefore stays private until Terraform has attached Access and
 * synced this flag back into the deployment environment.
 */
export const applicationRegistryWorkersDevEnabled = Config.boolean(
  applicationRegistryWorkersDevEnabledEnv
).pipe(Config.withDefault(false))
