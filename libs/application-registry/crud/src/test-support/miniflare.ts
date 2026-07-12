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
    await harness.#migrate()
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

  async #migrate() {
    const migrations = readMigrationFiles({
      migrationsFolder: this.#migrationsPath,
    })
    const statements = migrations.flatMap((migration) =>
      migration.sql
        .map((sql) => sql.trim())
        .filter(Boolean)
        .map((sql) => this.database.prepare(sql))
    )
    await this.database.batch(statements)
  }
}
