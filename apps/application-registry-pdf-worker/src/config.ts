import { Config, Effect, type Redacted } from 'effect'

export interface PdfWorkerConfiguration {
  readonly heartbeatMilliseconds: number
  readonly minio: {
    readonly accessKeyId: Redacted.Redacted<string>
    readonly endpoint: URL
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

const url = (name: string) =>
  Config.nonEmptyString(name).pipe(
    Effect.flatMap((value) =>
      Effect.try({
        try: () => new URL(value),
        catch: () => new Error(`${name} must be an absolute URL.`),
      })
    )
  )

export const readPdfWorkerConfiguration: Effect.Effect<
  PdfWorkerConfiguration,
  unknown
> = Effect.all({
  heartbeatMilliseconds: Config.int('PDF_HEARTBEAT_MILLISECONDS').pipe(
    Config.withDefault(30_000)
  ),
  minio: Effect.all({
    accessKeyId: Config.redacted('MINIO_ACCESS_KEY_ID'),
    endpoint: url('MINIO_ENDPOINT'),
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
      Config.withDefault(3)
    ),
    password: Config.redacted('POSTGRES_PASSWORD'),
    port: Config.port('POSTGRES_PORT').pipe(Config.withDefault(5432)),
    username: Config.nonEmptyString('POSTGRES_USER'),
  }),
}).pipe(
  Effect.flatMap((configuration) =>
    configuration.heartbeatMilliseconds >= 5_000 &&
    configuration.heartbeatMilliseconds <= 60_000 &&
    configuration.postgres.maxConnections >= 1 &&
    configuration.postgres.maxConnections <= 6
      ? Effect.succeed(configuration)
      : Effect.fail(
          new Error(
            'PDF_HEARTBEAT_MILLISECONDS must be 5000-60000 and POSTGRES_MAX_CONNECTIONS must be 1-6.'
          )
        )
  )
)
