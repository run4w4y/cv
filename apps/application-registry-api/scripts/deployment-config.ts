import { Config } from 'effect'

export const applicationRegistryWorkersDevEnabledEnv =
  'APPLICATION_REGISTRY_WORKERS_DEV_ENABLED'

export const applicationRegistryCvAppBindingEnabledEnv =
  'APPLICATION_REGISTRY_CV_APP_BINDING_ENABLED'

/**
 * The registry's public hostname is Terraform/Access owned. A fresh Worker
 * deployment therefore stays private until Terraform has attached Access and
 * synced this flag back into the deployment environment.
 */
export const applicationRegistryWorkersDevEnabled = Config.boolean(
  applicationRegistryWorkersDevEnabledEnv
).pipe(Config.withDefault(false))

/**
 * Steady-state registry deployments invalidate public CV cache entries through
 * CV_APP. A first deployment may explicitly disable this binding until the
 * cv-public Worker exists; all ordinary and CI deployments keep it enabled.
 */
export const applicationRegistryCvAppBindingEnabled = Config.boolean(
  applicationRegistryCvAppBindingEnabledEnv
).pipe(Config.withDefault(true))
