import { applicationRegistryRelations } from '@cv/application-registry-entity'
import {
  type EffectPgDatabase,
  type EffectPgQueryResultHKT,
  type EffectPgTransaction,
  effectPgCodecs,
  makeWithDefaults,
} from 'drizzle-orm/effect-postgres'
import { Context, Layer } from 'effect'

export type RegistryDatabase = EffectPgDatabase<
  typeof applicationRegistryRelations
>

export type RegistryTransaction = EffectPgTransaction<
  EffectPgQueryResultHKT,
  typeof applicationRegistryRelations
>

/** A PostgreSQL executor, either the pooled database or a transaction handle. */
export type RegistryExecutor = RegistryDatabase | RegistryTransaction

export const RegistryDatabase = Context.Service<RegistryDatabase>(
  '@cv/application-registry-crud/RegistryDatabase'
)

const canonicalUtcTimestamp = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new TypeError('PostgreSQL returned a non-timestamp value.')
  }

  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('PostgreSQL returned an invalid timestamp.')
  }
  return instant.toISOString()
}

/**
 * Effect SQL returns PostgreSQL's textual timestamptz representation by
 * default. Normalize it at the driver boundary so the registry keeps its
 * canonical UTC ISO-string contract on every read and `returning` clause.
 */
export const registryPgCodecs = {
  ...effectPgCodecs,
  'timestamptz:string': {
    ...effectPgCodecs['timestamptz:string'],
    normalize: canonicalUtcTimestamp,
    normalizeInJson: canonicalUtcTimestamp,
  },
}

/** Builds the configured Drizzle database from the scoped `PgClient`. */
export const makeRegistryDatabase = makeWithDefaults({
  codecs: registryPgCodecs,
  relations: applicationRegistryRelations,
})

/** Builds the Drizzle database from the scoped `PgClient` in the environment. */
export const RegistryDatabaseLive = Layer.effect(
  RegistryDatabase,
  makeRegistryDatabase
)
