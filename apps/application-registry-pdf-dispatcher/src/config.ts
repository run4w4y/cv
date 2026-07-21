import { Config, Effect, type Redacted } from 'effect'

export interface PdfDispatcherConfiguration {
  readonly batchSize: number
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

export const readPdfDispatcherConfiguration: Effect.Effect<
  PdfDispatcherConfiguration,
  unknown
> = Effect.all({
  batchSize: Config.int('PDF_DISPATCH_BATCH_SIZE').pipe(Config.withDefault(25)),
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
      Config.withDefault(2)
    ),
    password: Config.redacted('POSTGRES_PASSWORD'),
    port: Config.port('POSTGRES_PORT').pipe(Config.withDefault(5432)),
    username: Config.nonEmptyString('POSTGRES_USER'),
  }),
}).pipe(
  Effect.flatMap((configuration) =>
    configuration.batchSize >= 1 &&
    configuration.batchSize <= 100 &&
    configuration.postgres.maxConnections >= 1 &&
    configuration.postgres.maxConnections <= 4
      ? Effect.succeed(configuration)
      : Effect.fail(
          new Error(
            'PDF_DISPATCH_BATCH_SIZE must be 1-100 and POSTGRES_MAX_CONNECTIONS must be 1-4.'
          )
        )
  )
)
