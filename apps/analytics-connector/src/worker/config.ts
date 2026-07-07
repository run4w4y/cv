import {
  CLOUDFLARE_GRAPHQL_ENDPOINT,
  type CloudflareAnalyticsConfig,
} from '@cv/cloudflare-analytics-client'
import { Config, ConfigProvider, Data, Effect, Option, Schema } from 'effect'

import { WorkerEnv } from './bindings'
import type { AnalyticsConnectorEnv } from './types'

export const analyticsFallbackEnv = 'ANALYTICS_FALLBACK'
export const cacheTtlSecondsEnv = 'CACHE_TTL_SECONDS'
export const cloudflareAnalyticsApiTokenEnv = 'CLOUDFLARE_ANALYTICS_API_TOKEN'
export const cloudflareGraphqlEndpointEnv = 'CLOUDFLARE_GRAPHQL_ENDPOINT'
export const cloudflareZoneIdEnv = 'CLOUDFLARE_ZONE_ID'
export const privateAudienceKeyEnv = 'PRIVATE_CONTENT_AUDIENCE_KEY'
export const cvWebHostEnv = 'CV_WEB_HOST'
export const grafanaConnectorTokenEnv = 'GRAFANA_CONNECTOR_TOKEN'

export const defaultCacheTtlSeconds = 600

export type AnalyticsFallback = 'empty' | 'sample'

export class AnalyticsConnectorConfigError extends Data.TaggedError(
  'AnalyticsConnectorConfigError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {
  static fromConfigError(cause: Config.ConfigError) {
    return new AnalyticsConnectorConfigError({
      cause,
      message: cause.message,
    })
  }

  static incompleteCloudflareEnv(missing: readonly string[]) {
    return new AnalyticsConnectorConfigError({
      message: `Cloudflare analytics environment is incomplete. Missing: ${missing.join(
        ', '
      )}`,
    })
  }
}

export const configProviderFromRecord = (
  env: Readonly<Record<string, string | undefined>>
) =>
  ConfigProvider.fromEnv({
    env: Object.fromEntries(
      Object.entries(env).flatMap(([key, value]) => {
        const trimmed = value?.trim()

        return trimmed ? [[key, trimmed]] : []
      })
    ),
  })

export const withConfigRecord = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  env: Readonly<Record<string, string | undefined>>
) =>
  effect.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      configProviderFromRecord(env)
    )
  )

export const withWorkerEnvConfig = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  WorkerEnv.pipe(
    Effect.flatMap((env) =>
      effect.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          configProviderFromRecord(env)
        )
      )
    )
  )

const optionalStringConfig = (name: string) =>
  Config.nonEmptyString(name).pipe(
    Config.option,
    Effect.map(Option.getOrUndefined),
    Effect.mapError(AnalyticsConnectorConfigError.fromConfigError)
  )

export const readAnalyticsFallback = Config.literals(
  ['empty', 'sample'],
  analyticsFallbackEnv
).pipe(
  Config.option,
  Effect.map(Option.getOrUndefined),
  Effect.mapError(AnalyticsConnectorConfigError.fromConfigError)
)

export const readCacheTtlSeconds = Config.schema(
  Schema.NumberFromString.pipe(
    Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
  ),
  cacheTtlSecondsEnv
).pipe(
  Config.withDefault(defaultCacheTtlSeconds),
  Effect.mapError(AnalyticsConnectorConfigError.fromConfigError)
)

export const readGrafanaConnectorToken = Config.schema(
  Schema.RedactedFromValue(Schema.NonEmptyString),
  grafanaConnectorTokenEnv
).pipe(Effect.mapError(AnalyticsConnectorConfigError.fromConfigError))

export const readPrivateAudienceKey = optionalStringConfig(
  privateAudienceKeyEnv
)

const optionalCloudflareAnalyticsToken = Config.schema(
  Schema.RedactedFromValue(Schema.NonEmptyString),
  cloudflareAnalyticsApiTokenEnv
).pipe(
  Config.option,
  Effect.mapError(AnalyticsConnectorConfigError.fromConfigError)
)

const optionalCloudflareZoneId = Config.nonEmptyString(
  cloudflareZoneIdEnv
).pipe(
  Config.option,
  Effect.mapError(AnalyticsConnectorConfigError.fromConfigError)
)

export const readCloudflareGraphqlEndpoint = Config.url(
  cloudflareGraphqlEndpointEnv
).pipe(
  Config.withDefault(new URL(CLOUDFLARE_GRAPHQL_ENDPOINT)),
  Effect.map((url) => url.toString()),
  Effect.mapError(AnalyticsConnectorConfigError.fromConfigError)
)

export const readCloudflareAnalyticsWorkerConfig: Effect.Effect<
  CloudflareAnalyticsConfig | undefined,
  AnalyticsConnectorConfigError
> = Effect.gen(function* () {
  const apiToken = yield* optionalCloudflareAnalyticsToken
  const zoneId = yield* optionalCloudflareZoneId

  if (Option.isNone(apiToken) && Option.isNone(zoneId)) {
    return undefined
  }

  if (Option.isNone(apiToken) || Option.isNone(zoneId)) {
    const missing = [
      ...(Option.isSome(apiToken) ? [] : [cloudflareAnalyticsApiTokenEnv]),
      ...(Option.isSome(zoneId) ? [] : [cloudflareZoneIdEnv]),
    ]

    return yield* AnalyticsConnectorConfigError.incompleteCloudflareEnv(missing)
  }

  const endpoint = yield* readCloudflareGraphqlEndpoint
  const host = yield* optionalStringConfig(cvWebHostEnv)

  return {
    apiToken: apiToken.value,
    endpoint,
    ...(host ? { host } : {}),
    zoneId: zoneId.value,
  }
})

export const readAnalyticsConnectorConfig = Effect.all({
  cloudflare: readCloudflareAnalyticsWorkerConfig,
  fallback: readAnalyticsFallback,
})

export type AnalyticsConnectorConfig = {
  readonly cloudflare: CloudflareAnalyticsConfig | undefined
  readonly fallback: AnalyticsFallback | undefined
}

export const withAnalyticsConnectorEnv = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  env: AnalyticsConnectorEnv
) => withConfigRecord(effect, env)
