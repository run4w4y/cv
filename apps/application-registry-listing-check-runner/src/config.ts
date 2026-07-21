import type { RunDueListingChecksInput } from '@cv/application-registry-service'
import { Config, Effect, type Redacted, Schema } from 'effect'

export interface RunnerConfiguration {
  readonly limit: number
  readonly maxConnections: number
  readonly mode: RunDueListingChecksInput['mode']
  readonly postgres: {
    readonly database: string
    readonly host: string
    readonly password: Redacted.Redacted<string>
    readonly port: number
    readonly username: string
  }
}

const ListingCheckModeSchema = Schema.Literals(['report', 'archive_eligible'])

export const readRunnerConfiguration: Effect.Effect<
  RunnerConfiguration,
  unknown
> = Effect.all({
  limit: Config.int('LISTING_CHECK_BATCH_SIZE').pipe(Config.withDefault(5)),
  maxConnections: Config.int('POSTGRES_MAX_CONNECTIONS').pipe(
    Config.withDefault(4)
  ),
  mode: Config.schema(ListingCheckModeSchema, 'LISTING_CHECK_MODE').pipe(
    Config.withDefault('archive_eligible')
  ),
  postgres: Effect.all({
    database: Config.nonEmptyString('POSTGRES_DATABASE'),
    host: Config.nonEmptyString('POSTGRES_HOST'),
    password: Config.redacted('POSTGRES_PASSWORD'),
    port: Config.port('POSTGRES_PORT').pipe(Config.withDefault(5432)),
    username: Config.nonEmptyString('POSTGRES_USER'),
  }),
}).pipe(
  Effect.flatMap((configuration) =>
    configuration.limit >= 1 &&
    configuration.limit <= 50 &&
    configuration.maxConnections >= 1 &&
    configuration.maxConnections <= 10
      ? Effect.succeed(configuration)
      : Effect.fail(
          new Error(
            'LISTING_CHECK_BATCH_SIZE must be 1-50 and POSTGRES_MAX_CONNECTIONS must be 1-10.'
          )
        )
  )
)
