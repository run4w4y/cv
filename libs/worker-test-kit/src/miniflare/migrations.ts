import type { D1Database } from '@cloudflare/workers-types'
import { readMigrationFiles } from 'drizzle-orm/migrator'

export type D1MigrationFiles = ReturnType<typeof readMigrationFiles>

export interface D1MigrationOptions {
  readonly migrationsPath: string
  readonly throughMigration?: string
}

export const readD1MigrationPlan = ({
  migrationsPath,
  throughMigration,
}: D1MigrationOptions): D1MigrationFiles => {
  const migrations = readMigrationFiles({ migrationsFolder: migrationsPath })
  if (migrations.length === 0) {
    throw new Error(`No D1 migrations found in ${migrationsPath}.`)
  }
  if (throughMigration === undefined) return migrations

  const migrationIndex = migrations.findIndex(
    ({ name }) => name === throughMigration
  )
  if (migrationIndex < 0) {
    throw new Error(`D1 migration ${throughMigration} was not found.`)
  }
  return migrations.slice(0, migrationIndex + 1)
}

export const applyD1Migrations = async (
  database: D1Database,
  migrations: D1MigrationFiles
) => {
  for (const migration of migrations) {
    const statements = migration.sql
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement))
    if (statements.length > 0) await database.batch(statements)
  }
}

export const migrationsAfter = (
  migrationsPath: string,
  migrationName: string
) => {
  const migrations = readD1MigrationPlan({ migrationsPath })
  const migrationIndex = migrations.findIndex(
    ({ name }) => name === migrationName
  )
  if (migrationIndex < 0) {
    throw new Error(`D1 migration ${migrationName} was not found.`)
  }
  return migrations.slice(migrationIndex + 1)
}
