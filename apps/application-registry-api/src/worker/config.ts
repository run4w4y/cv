import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import type { Redacted } from 'effect'
import {
  Config,
  ConfigProvider,
  Effect,
  Layer,
  Option,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from 'effect'

export const registryApiTokenEnv = 'REGISTRY_API_TOKEN'
export const chatGPTSessionSecretEnv = 'CHATGPT_SESSION_SECRET'
export const listingChecksEnabledEnv = 'LISTING_CHECKS_ENABLED'
export const listingCheckArchiveEnabledEnv = 'LISTING_CHECK_ARCHIVE_ENABLED'
export const listingCheckBatchSizeEnv = 'LISTING_CHECK_BATCH_SIZE'

const cloudflareAnalyticsApiTokenEnv = 'CLOUDFLARE_ANALYTICS_API_TOKEN'
const cloudflareGraphqlEndpointEnv = 'CLOUDFLARE_GRAPHQL_ENDPOINT'
const cloudflareZoneIdEnv = 'CLOUDFLARE_ZONE_ID'
const cvWebHostEnv = 'CV_WEB_HOST'

export const defaultListingCheckBatchSize = 5
export const maximumListingCheckBatchSize = 10

const nonEmptyTrimmedStringSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty())
)

const redactedSecret = (label: string) =>
  Schema.RedactedFromValue(nonEmptyTrimmedStringSchema, { label })

const positiveIntegerFromStringSchema = Schema.NumberFromString.pipe(
  Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
)

const runtimeUrlSchema = Schema.instanceOf(globalThis.URL)

// Workerd does not expose URL.canParse in every supported runtime. Keep URL
// validation at the configuration boundary without relying on that optional API.
const urlFromStringSchema = Schema.String.pipe(
  Schema.decodeTo(
    runtimeUrlSchema,
    SchemaTransformation.transformOrFail({
      decode: (value) =>
        Effect.try({
          try: () => new URL(value),
          catch: () =>
            new SchemaIssue.InvalidValue(Option.some(value), {
              message: `Invalid URL string: ${value}`,
            }),
        }),
      encode: (value) => Effect.succeed(value.href),
    })
  )
)

const optionalString = (name: string) =>
  Config.schema(nonEmptyTrimmedStringSchema, name).pipe(
    Config.option,
    Config.map(Option.getOrUndefined)
  )

export interface ListingChecksConfiguration {
  readonly archiveEnabled: boolean
  readonly batchSize: number
  readonly enabled: boolean
}

export class WorkerConfigurationError extends Schema.TaggedErrorClass<WorkerConfigurationError>()(
  'Worker.ConfigurationError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

const configurationError = (message: string) => (cause: Config.ConfigError) =>
  new WorkerConfigurationError({ cause, message })

export const readRegistryApiToken: Effect.Effect<
  Redacted.Redacted<string>,
  WorkerConfigurationError
> = Config.schema(
  redactedSecret(registryApiTokenEnv),
  registryApiTokenEnv
).pipe(
  Effect.mapError(
    configurationError('Registry API authentication is not configured.')
  )
)

export const readChatGPTSessionSecret: Effect.Effect<
  Redacted.Redacted<string>,
  WorkerConfigurationError
> = Config.schema(
  redactedSecret(chatGPTSessionSecretEnv),
  chatGPTSessionSecretEnv
).pipe(
  Effect.mapError(
    configurationError('ChatGPT subscription authentication is not configured.')
  )
)

export const readListingChecksConfiguration: Effect.Effect<
  ListingChecksConfiguration,
  WorkerConfigurationError
> = Effect.all({
  archiveEnabled: Config.boolean(listingCheckArchiveEnabledEnv).pipe(
    Config.withDefault(false)
  ),
  batchSize: Config.schema(
    positiveIntegerFromStringSchema,
    listingCheckBatchSizeEnv
  ).pipe(
    Config.withDefault(defaultListingCheckBatchSize),
    Config.map((value) => Math.min(value, maximumListingCheckBatchSize))
  ),
  enabled: Config.boolean(listingChecksEnabledEnv).pipe(
    Config.withDefault(true)
  ),
}).pipe(
  Effect.mapError(
    configurationError('Scheduled listing-check configuration is invalid.')
  )
)

const readCloudflareConfig = Effect.all({
  apiToken: Config.schema(
    redactedSecret(cloudflareAnalyticsApiTokenEnv),
    cloudflareAnalyticsApiTokenEnv
  ),
  endpoint: Config.schema(
    urlFromStringSchema,
    cloudflareGraphqlEndpointEnv
  ).pipe(Config.withDefault(new URL(CloudflareAnalytics.defaultEndpoint))),
  host: optionalString(cvWebHostEnv),
  zoneId: Config.schema(nonEmptyTrimmedStringSchema, cloudflareZoneIdEnv),
}).pipe(
  Effect.map(({ apiToken, endpoint, host, zoneId }) =>
    CloudflareAnalytics.Configuration.of({
      apiToken,
      endpoint,
      ...(host ? { host } : {}),
      zoneId,
    })
  ),
  Effect.mapError(
    configurationError('Cloudflare analytics configuration is invalid.')
  )
)

export const CloudflareConfigLive = Layer.effect(
  CloudflareAnalytics.Configuration,
  readCloudflareConfig
)

/**
 * Adapts the Cloudflare binding object once. Config recipes read their native
 * environment names directly; no per-feature object reconstruction is needed.
 */
export const workerConfigurationProviderLayer = (environment: object) =>
  ConfigProvider.layer(ConfigProvider.fromUnknown(environment))

export const provideWorkerConfiguration = (environment: object) =>
  Effect.provide(workerConfigurationProviderLayer(environment))
