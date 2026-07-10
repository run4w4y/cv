import { Config, ConfigProvider, Effect, Option, Schema } from 'effect'

import { CloudflareAnalyticsConfigError } from './errors'
import {
  CLOUDFLARE_GRAPHQL_ENDPOINT,
  type CloudflareAnalyticsConfig,
  type CloudflareAnalyticsEnv,
} from './types'

const apiTokenEnv = 'CLOUDFLARE_API_TOKEN'
const endpointEnv = 'CLOUDFLARE_GRAPHQL_ENDPOINT'
const hostEnv = 'CV_WEB_HOST'
const zoneIdEnv = 'CLOUDFLARE_ZONE_ID'

const defaultEnv = (): CloudflareAnalyticsEnv => process.env

const trimmedEnvRecord = (env: CloudflareAnalyticsEnv) =>
  Object.fromEntries(
    Object.entries(env).flatMap(([key, value]) => {
      const trimmed = value?.trim()

      return trimmed ? [[key, trimmed]] : []
    })
  )

const configProviderFromEnv = (env: CloudflareAnalyticsEnv = defaultEnv()) =>
  ConfigProvider.fromEnv({
    env: trimmedEnvRecord(env),
  })

const optionalStringFromEnv = (env: CloudflareAnalyticsEnv, name: string) => {
  const value = env[name]?.trim()

  return value ? value : undefined
}

const redactedNonEmptyStringSchema = Schema.RedactedFromValue(
  Schema.NonEmptyString
)

export const cloudflareAnalyticsConfigProviderFromEnv = (
  env: CloudflareAnalyticsEnv
) => configProviderFromEnv(env)

export const withCloudflareAnalyticsEnv = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  env: CloudflareAnalyticsEnv
) =>
  effect.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      cloudflareAnalyticsConfigProviderFromEnv(env)
    )
  )

export const hasCloudflareAnalyticsEnv = (
  env: CloudflareAnalyticsEnv = defaultEnv()
) =>
  Boolean(
    optionalStringFromEnv(env, apiTokenEnv) &&
      optionalStringFromEnv(env, zoneIdEnv)
  )

const optionalStringConfig = (name: string) =>
  Config.nonEmptyString(name).pipe(
    Config.option,
    Config.map(Option.getOrUndefined),
    Effect.mapError(CloudflareAnalyticsConfigError.fromConfigError)
  )

const requiredTokenConfig = Config.schema(
  redactedNonEmptyStringSchema,
  apiTokenEnv
).pipe(
  Config.option,
  Effect.mapError(CloudflareAnalyticsConfigError.fromConfigError)
)

const requiredZoneConfig = Config.nonEmptyString(zoneIdEnv).pipe(
  Config.option,
  Effect.mapError(CloudflareAnalyticsConfigError.fromConfigError)
)

export const readCloudflareAnalyticsConfig = (
  endpointOverride?: string
): Effect.Effect<CloudflareAnalyticsConfig, CloudflareAnalyticsConfigError> =>
  Effect.gen(function* () {
    const apiToken = yield* requiredTokenConfig
    const zoneId = yield* requiredZoneConfig

    if (Option.isNone(apiToken) || Option.isNone(zoneId)) {
      return yield* Effect.fail(
        CloudflareAnalyticsConfigError.missingEnv([
          ...(Option.isSome(apiToken) ? [] : [apiTokenEnv]),
          ...(Option.isSome(zoneId) ? [] : [zoneIdEnv]),
        ])
      )
    }

    const configuredEndpoint = yield* optionalStringConfig(endpointEnv)
    const host = yield* optionalStringConfig(hostEnv)
    const endpoint =
      endpointOverride?.trim() ||
      configuredEndpoint ||
      CLOUDFLARE_GRAPHQL_ENDPOINT

    return {
      apiToken: apiToken.value,
      endpoint,
      ...(host ? { host } : {}),
      zoneId: zoneId.value,
    } satisfies CloudflareAnalyticsConfig
  })

export const readCloudflareAnalyticsConfigFromEnv = (
  env: CloudflareAnalyticsEnv = defaultEnv(),
  endpoint?: string
): Effect.Effect<CloudflareAnalyticsConfig, CloudflareAnalyticsConfigError> =>
  withCloudflareAnalyticsEnv(readCloudflareAnalyticsConfig(endpoint), env)
