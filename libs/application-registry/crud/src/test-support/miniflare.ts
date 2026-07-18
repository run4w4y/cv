import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { D1Database } from '@cloudflare/workers-types'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { Miniflare } from 'miniflare'

const workspaceRoot = fileURLToPath(new URL('../../../../../', import.meta.url))
const defaultMigrationsPath = join(
  workspaceRoot,
  'libs/application-registry/entity/drizzle'
)

const bindingHostWorker = `
export default {
  fetch() {
    return new Response(null, { status: 204 })
  }
}
`

type QueryParameter = string | number | null

export interface RegistryMiniflareHarnessOptions {
  readonly databaseBinding: string
  readonly databaseId?: string
  readonly migrationsPath?: string
  readonly throughMigration?: string
}

export class RegistryMiniflareHarness {
  readonly #miniflare: Miniflare
  readonly #persistPath: string
  readonly #migrationsPath: string
  readonly database: D1Database

  private constructor(
    miniflare: Miniflare,
    persistPath: string,
    database: D1Database,
    migrationsPath: string
  ) {
    this.#miniflare = miniflare
    this.#persistPath = persistPath
    this.database = database
    this.#migrationsPath = migrationsPath
  }

  static async make(options: RegistryMiniflareHarnessOptions) {
    const persistPath = await mkdtemp(join(tmpdir(), 'application-registry-'))
    const workerName = 'application-registry-test'
    const databaseId = options.databaseId ?? workerName
    const miniflare = new Miniflare({
      compatibilityDate: '2026-06-22',
      d1Persist: persistPath,
      workers: [
        {
          d1Databases: { [options.databaseBinding]: databaseId },
          modules: true,
          name: workerName,
          script: bindingHostWorker,
        },
      ],
    })

    await miniflare.ready
    const harness = new RegistryMiniflareHarness(
      miniflare,
      persistPath,
      await miniflare.getD1Database(options.databaseBinding, workerName),
      options.migrationsPath ?? defaultMigrationsPath
    )
    await harness.#migrateThrough(options.throughMigration)
    return harness
  }

  async query<Row>(
    sql: string,
    parameters: readonly QueryParameter[] = []
  ): Promise<readonly Row[]> {
    const result = await this.database
      .prepare(sql)
      .bind(...parameters)
      .all<Row>()
    return result.results
  }

  async dispose() {
    await this.#miniflare.dispose()
    await rm(this.#persistPath, { force: true, recursive: true })
  }

  async migrateAfter(migrationName: string) {
    const migrations = readMigrationFiles({
      migrationsFolder: this.#migrationsPath,
    })
    const migrationIndex = migrations.findIndex(
      ({ name }) => name === migrationName
    )
    if (migrationIndex < 0) {
      throw new Error(`Registry migration ${migrationName} was not found.`)
    }
    await this.#applyMigrations(migrations.slice(migrationIndex + 1))
  }

  async #migrateThrough(migrationName: string | undefined) {
    const migrations = readMigrationFiles({
      migrationsFolder: this.#migrationsPath,
    })
    if (migrationName === undefined) {
      await this.#applyMigrations(migrations)
      return
    }
    const migrationIndex = migrations.findIndex(
      ({ name }) => name === migrationName
    )
    if (migrationIndex < 0) {
      throw new Error(`Registry migration ${migrationName} was not found.`)
    }
    await this.#applyMigrations(migrations.slice(0, migrationIndex + 1))
  }

  async #applyMigrations(migrations: ReturnType<typeof readMigrationFiles>) {
    for (const migration of migrations) {
      const statements = migration.sql
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => this.database.prepare(statement))
      if (statements.length > 0) await this.database.batch(statements)
    }
  }
}
