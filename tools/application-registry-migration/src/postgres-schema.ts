import { fileURLToPath } from 'node:url'
import { PgClient } from '@effect/sql-pg'
import { makeWithDefaults } from 'drizzle-orm/effect-postgres'
import { migrate } from 'drizzle-orm/effect-postgres/migrator'
import { Effect } from 'effect'

import { migrationError, type RegistryMigrationError } from './errors'
import {
  type PostgresImportConfiguration,
  postgresClientLayer,
  targetCatalogFingerprint,
  targetCatalogQuery,
  validateTargetBaselineFingerprint,
  verifyTargetBaseline,
} from './postgres-target'

/** Resolve from this module so the command works independently of its cwd. */
export const registryMigrationsFolder = fileURLToPath(
  new URL('../../../libs/application-registry/entity/drizzle/', import.meta.url)
)

const verifySchemaApplicationTarget = Effect.fn(
  'ApplicationRegistryMigration.verifySchemaApplicationTarget'
)(function* (): Effect.fn.Return<
  void,
  RegistryMigrationError,
  PgClient.PgClient
> {
  const client = yield* PgClient.PgClient
  const rows = yield* client
    .unsafe<{ signature: string }>(targetCatalogQuery)
    .pipe(
      Effect.mapError(
        migrationError(
          'inspect PostgreSQL schema application target',
          'Could not inspect the PostgreSQL target before applying migrations.'
        )
      )
    )

  if (rows.length > 0) {
    yield* validateTargetBaselineFingerprint(
      targetCatalogFingerprint(rows.map(({ signature }) => signature))
    )
  }
})

const applyMigrations = Effect.fn(
  'ApplicationRegistryMigration.applyMigrations'
)(function* (): Effect.fn.Return<
  void,
  RegistryMigrationError,
  PgClient.PgClient
> {
  yield* verifySchemaApplicationTarget()

  const database = yield* makeWithDefaults()
  const migration = yield* Effect.try({
    try: () =>
      migrate(database, {
        migrationsFolder: registryMigrationsFolder,
      }).pipe(
        Effect.mapError(
          migrationError(
            'apply PostgreSQL schema',
            'Could not apply the application-registry PostgreSQL migrations.'
          )
        )
      ),
    catch: migrationError(
      'read PostgreSQL migrations',
      'Could not read the application-registry PostgreSQL migrations.'
    ),
  })
  yield* migration

  const client = yield* PgClient.PgClient
  yield* verifyTargetBaseline(client)
})

export const applyRegistrySchema = Effect.fn(
  'ApplicationRegistryMigration.applyRegistrySchema'
)((config: PostgresImportConfiguration) =>
  applyMigrations().pipe(
    Effect.provide(postgresClientLayer(config, 'cv-registry-schema')),
    Effect.as({
      migrationsFolder: registryMigrationsFolder,
      mode: 'schema-current' as const,
    })
  )
)
