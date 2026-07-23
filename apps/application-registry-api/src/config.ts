import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { Config, Effect, type Redacted } from 'effect'

export interface ApiServerConfiguration {
  readonly analytics: {
    readonly apiToken: Redacted.Redacted<string>
    readonly endpoint: URL
    readonly host: string
    readonly zoneId: string
  }
  readonly authentication: {
    readonly factsPublishToken: Redacted.Redacted<string>
    readonly registryApiToken: Redacted.Redacted<string>
  }
  readonly cacheInvalidation: {
    readonly endpoint: URL
  }
  readonly cors: {
    readonly allowedOrigins: ReadonlyArray<string>
  }
  readonly http: {
    readonly host: string
    readonly port: number
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

const corsAllowedOrigins = Config.nonEmptyString(
  'REGISTRY_CORS_ALLOWED_ORIGINS'
).pipe(
  Config.withDefault('http://localhost:4300,http://127.0.0.1:4300'),
  Effect.flatMap((value) =>
    Effect.forEach(value.split(','), (candidate) =>
      Effect.try({
        try: () => {
          const origin = new URL(candidate.trim())
          if (
            !['http:', 'https:'].includes(origin.protocol) ||
            origin.username !== '' ||
            origin.password !== '' ||
            origin.pathname !== '/' ||
            origin.search !== '' ||
            origin.hash !== ''
          ) {
            throw new Error('Origin must contain only scheme, host, and port.')
          }
          return origin.origin
        },
        catch: () =>
          new Error(
            'REGISTRY_CORS_ALLOWED_ORIGINS must be a comma-separated list of HTTP(S) origins.'
          ),
      })
    )
  ),
  Effect.map((origins) => [...new Set(origins)])
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
    factsPublishToken: Config.redacted('FACTS_PUBLISH_TOKEN'),
    registryApiToken: Config.redacted('REGISTRY_API_TOKEN'),
  }),
  cacheInvalidation: Effect.all({
    endpoint: url(
      'CLOUDFLARE_API_ENDPOINT',
      'https://api.cloudflare.com/client/v4/'
    ),
  }),
  cors: Effect.all({
    allowedOrigins: corsAllowedOrigins,
  }),
  http: Effect.all({
    host: Config.nonEmptyString('SERVER_HOST').pipe(
      Config.withDefault('0.0.0.0')
    ),
    port: Config.port('SERVER_PORT').pipe(Config.withDefault(3000)),
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
