import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { Config, Effect, Option, type Redacted } from 'effect'

export interface ApiServerConfiguration {
  readonly analytics: {
    readonly apiToken: Redacted.Redacted<string>
    readonly endpoint: URL
    readonly host: string
    readonly zoneId: string
  }
  readonly authentication: {
    readonly bffEnabled: boolean
    readonly factsPublishToken: Redacted.Redacted<string>
    readonly registryApiToken: Redacted.Redacted<string>
  }
  readonly cacheInvalidation: {
    readonly secret: string | undefined
    readonly url: URL | undefined
  }
  readonly http: {
    readonly host: string
    readonly port: number
    readonly staticAssetsDirectory: string
  }
  readonly minio: {
    readonly accessKeyId: Redacted.Redacted<string>
    readonly endpoint: URL
    readonly factsBucket: string
    readonly forcePathStyle: boolean
    readonly objectsBucket: string
    readonly region: string
    readonly secretAccessKey: Redacted.Redacted<string>
  }
  readonly nats: {
    readonly password: Redacted.Redacted<string>
    readonly server: string
    readonly username: string
  }
  readonly postgres: {
    readonly database: string
    readonly host: string
    readonly maxConnections: number
    readonly password: Redacted.Redacted<string>
    readonly port: number
    readonly username: string
  }
}

const optionalString = (name: string) =>
  Config.option(Config.nonEmptyString(name)).pipe(
    Config.map(Option.getOrUndefined)
  )

const url = (name: string, fallback?: string) =>
  Config.nonEmptyString(name).pipe(
    fallback === undefined ? (value) => value : Config.withDefault(fallback),
    Effect.flatMap((value) =>
      Effect.try({
        try: () => new URL(value),
        catch: () => new Error(`${name} must be an absolute URL.`),
      })
    )
  )

const optionalUrl = (name: string) =>
  optionalString(name).pipe(
    Effect.flatMap((value) =>
      value === undefined
        ? Effect.succeed<URL | undefined>(undefined)
        : Effect.try({
            try: () => new URL(value),
            catch: () => new Error(`${name} must be an absolute URL.`),
          })
    )
  )

export const readApiServerConfiguration: Effect.Effect<
  ApiServerConfiguration,
  unknown
> = Effect.all({
  analytics: Effect.all({
    apiToken: Config.redacted('CLOUDFLARE_ANALYTICS_API_TOKEN'),
    endpoint: url(
      'CLOUDFLARE_GRAPHQL_ENDPOINT',
      CloudflareAnalytics.defaultEndpoint
    ),
    host: Config.nonEmptyString('CV_WEB_HOST'),
    zoneId: Config.nonEmptyString('CLOUDFLARE_ZONE_ID'),
  }),
  authentication: Effect.all({
    bffEnabled: Config.boolean('REGISTRY_BFF_ENABLED').pipe(
      Config.withDefault(false)
    ),
    factsPublishToken: Config.redacted('FACTS_PUBLISH_TOKEN'),
    registryApiToken: Config.redacted('REGISTRY_API_TOKEN'),
  }),
  cacheInvalidation: Effect.all({
    secret: optionalString('CV_REVALIDATION_SECRET'),
    url: optionalUrl('CV_REVALIDATION_URL'),
  }),
  http: Effect.all({
    host: Config.nonEmptyString('SERVER_HOST').pipe(
      Config.withDefault('0.0.0.0')
    ),
    port: Config.port('SERVER_PORT').pipe(Config.withDefault(3000)),
    staticAssetsDirectory: Config.nonEmptyString(
      'STATIC_ASSETS_DIRECTORY'
    ).pipe(Config.withDefault('/app/public')),
  }),
  minio: Effect.all({
    accessKeyId: Config.redacted('MINIO_ACCESS_KEY_ID'),
    endpoint: url('MINIO_ENDPOINT'),
    factsBucket: Config.nonEmptyString('MINIO_FACTS_BUCKET'),
    forcePathStyle: Config.boolean('MINIO_FORCE_PATH_STYLE').pipe(
      Config.withDefault(true)
    ),
    objectsBucket: Config.nonEmptyString('MINIO_OBJECTS_BUCKET'),
    region: Config.nonEmptyString('MINIO_REGION').pipe(
      Config.withDefault('ru-central')
    ),
    secretAccessKey: Config.redacted('MINIO_SECRET_ACCESS_KEY'),
  }),
  nats: Effect.all({
    password: Config.redacted('NATS_PASSWORD'),
    server: Config.nonEmptyString('NATS_SERVER').pipe(
      Config.withDefault('nats://127.0.0.1:4222')
    ),
    username: Config.nonEmptyString('NATS_USER'),
  }),
  postgres: Effect.all({
    database: Config.nonEmptyString('POSTGRES_DATABASE'),
    host: Config.nonEmptyString('POSTGRES_HOST'),
    maxConnections: Config.int('POSTGRES_MAX_CONNECTIONS').pipe(
      Config.withDefault(6)
    ),
    password: Config.redacted('POSTGRES_PASSWORD'),
    port: Config.port('POSTGRES_PORT').pipe(Config.withDefault(5432)),
    username: Config.nonEmptyString('POSTGRES_USER'),
  }),
}).pipe(
  Effect.flatMap((configuration) => {
    const cachePairIsComplete =
      (configuration.cacheInvalidation.url === undefined) ===
      (configuration.cacheInvalidation.secret === undefined)
    if (!cachePairIsComplete) {
      return Effect.fail(
        new Error(
          'CV_REVALIDATION_URL and CV_REVALIDATION_SECRET must be configured together.'
        )
      )
    }
    if (
      configuration.postgres.maxConnections < 1 ||
      configuration.postgres.maxConnections > 20
    ) {
      return Effect.fail(
        new Error('POSTGRES_MAX_CONNECTIONS must be between 1 and 20.')
      )
    }
    return Effect.succeed(configuration)
  })
)
