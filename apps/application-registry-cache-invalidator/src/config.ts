import { Config, Effect, type Redacted } from 'effect'

export interface CacheInvalidatorConfiguration {
  readonly cloudflare: {
    readonly apiToken: Redacted.Redacted<string>
    readonly endpoint: URL
    readonly publicBaseUrl: URL
    readonly zoneId: string
  }
  readonly nats: {
    readonly password: Redacted.Redacted<string>
    readonly server: string
    readonly username: string
  }
}

const url = (name: string, fallback: string) =>
  Config.nonEmptyString(name).pipe(
    Config.withDefault(fallback),
    Effect.flatMap((value) =>
      Effect.try({
        try: () => new URL(value),
        catch: () => new Error(`${name} must be an absolute URL.`),
      })
    )
  )

const publicCvBaseUrl = Config.nonEmptyString('CV_WEB_HOST').pipe(
  Effect.flatMap((host) =>
    Effect.try({
      try: () => new URL(`https://${host}/c/`),
      catch: () =>
        new Error('CV_WEB_HOST must produce a valid public HTTP(S) URL.'),
    })
  )
)

export const readCacheInvalidatorConfiguration: Effect.Effect<
  CacheInvalidatorConfiguration,
  unknown
> = Effect.all({
  cloudflare: Effect.all({
    apiToken: Config.redacted('CLOUDFLARE_CACHE_PURGE_API_TOKEN'),
    endpoint: url(
      'CLOUDFLARE_API_ENDPOINT',
      'https://api.cloudflare.com/client/v4/'
    ),
    publicBaseUrl: publicCvBaseUrl,
    zoneId: Config.nonEmptyString('CLOUDFLARE_ZONE_ID'),
  }),
  nats: Effect.all({
    password: Config.redacted('NATS_PASSWORD'),
    server: Config.nonEmptyString('NATS_SERVER').pipe(
      Config.withDefault('nats://127.0.0.1:4222')
    ),
    username: Config.nonEmptyString('NATS_USER'),
  }),
})
