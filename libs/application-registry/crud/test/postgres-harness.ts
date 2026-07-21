import { readFile } from 'node:fs/promises'
import {
  type StartedPostgresTestContainer,
  startPostgresTestContainer,
} from '@cv/test-infrastructure/postgres'
import { PgClient } from '@effect/sql-pg'
import { Effect, ManagedRuntime, Redacted } from 'effect'

import {
  RegistryDatabase,
  RegistryDatabaseLive,
  type RegistryDatabaseShape,
} from '../src/live'

const migrationUrl = new URL(
  '../../entity/drizzle/20260721013933_useful_harrier/migration.sql',
  import.meta.url
)

const tableNames = [
  'application_activities',
  'application_compensations',
  'application_labels',
  'application_listing_check_schedules',
  'application_listing_checks',
  'application_notes',
  'applications',
  'content_entries',
  'content_revisions',
  'cv_links',
  'generated_artifacts',
  'idempotency_receipts',
  'job_posting_snapshots',
  'listing_check_runs',
  'pdf_generation_outbox',
  'registry_sequence',
] as const

const makePostgresRuntime = (container: StartedPostgresTestContainer) =>
  ManagedRuntime.make(
    PgClient.layer({
      applicationName: 'application-registry-crud-integration',
      database: container.database,
      host: container.host,
      maxConnections: 4,
      password: Redacted.make(container.password),
      port: container.port,
      username: container.username,
    })
  )

type Runtime = ReturnType<typeof makePostgresRuntime>

/** A disposable PostgreSQL 17 database with the canonical baseline applied. */
export class RegistryPostgresHarness {
  readonly database: RegistryDatabaseShape

  readonly #container: StartedPostgresTestContainer
  readonly #runtime: Runtime

  private constructor(
    container: StartedPostgresTestContainer,
    runtime: Runtime,
    database: RegistryDatabaseShape
  ) {
    this.#container = container
    this.#runtime = runtime
    this.database = database
  }

  static async make(): Promise<RegistryPostgresHarness> {
    const container = await startPostgresTestContainer({
      database: 'application_registry',
      password: 'registry-test',
      username: 'registry',
    })
    const runtime = makePostgresRuntime(container)

    try {
      const migration = await readFile(migrationUrl, 'utf8')
      const statements = migration
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean)
      await runtime.runPromise(
        Effect.gen(function* () {
          const client = yield* PgClient.PgClient
          yield* Effect.forEach(
            statements,
            (statement) => client.unsafe(statement),
            { concurrency: 1, discard: true }
          )
        })
      )
      const database = await runtime.runPromise(
        RegistryDatabase.pipe(Effect.provide(RegistryDatabaseLive))
      )
      return new RegistryPostgresHarness(container, runtime, database)
    } catch (error) {
      await runtime.dispose()
      await container.dispose()
      throw error
    }
  }

  query<A extends object>(
    statement: string,
    parameters: ReadonlyArray<unknown> = []
  ): Promise<ReadonlyArray<A>> {
    return this.#runtime.runPromise(
      Effect.gen(function* () {
        const client = yield* PgClient.PgClient
        return yield* client.unsafe<A>(statement, parameters)
      })
    )
  }

  async reset(): Promise<void> {
    await this.query(
      `truncate table ${tableNames.map((name) => `"${name}"`).join(', ')} cascade`
    )
  }

  async dispose(): Promise<void> {
    await this.#runtime.dispose()
    await this.#container.dispose()
  }
}
