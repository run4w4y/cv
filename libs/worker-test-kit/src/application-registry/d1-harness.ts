import { fileURLToPath } from 'node:url'
import type { D1Database } from '@cloudflare/workers-types'

import {
  applyD1Migrations,
  MiniflareTestEnvironment,
  migrationsAfter,
  readD1MigrationPlan,
  resetD1Database,
  workerTestCompatibilityDate,
} from '../miniflare'
import { applicationRegistryBindings } from './bindings'

const defaultMigrationsPath = fileURLToPath(
  new URL('../../../application-registry/entity/drizzle', import.meta.url)
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
  readonly databaseBinding?: string
  readonly databaseId?: string
  readonly migrationsPath?: string
  readonly throughMigration?: string
}

/** D1-only registry environment used by CRUD and service integration tests. */
export class RegistryMiniflareHarness {
  readonly database: D1Database

  readonly #environment: MiniflareTestEnvironment
  readonly #migrationsPath: string

  private constructor(
    environment: MiniflareTestEnvironment,
    database: D1Database,
    migrationsPath: string
  ) {
    this.#environment = environment
    this.database = database
    this.#migrationsPath = migrationsPath
  }

  static async make(options: RegistryMiniflareHarnessOptions = {}) {
    const databaseBinding =
      options.databaseBinding ?? applicationRegistryBindings.database
    const workerName = 'application-registry-test'
    const environment = await MiniflareTestEnvironment.make(
      {
        compatibilityDate: workerTestCompatibilityDate,
        workers: [
          {
            d1Databases: {
              [databaseBinding]: options.databaseId ?? workerName,
            },
            modules: true,
            name: workerName,
            script: bindingHostWorker,
          },
        ],
      },
      {
        persist: ['d1'],
        temporaryDirectoryPrefix: 'application-registry-d1-test-',
      }
    )

    try {
      const database = await environment.miniflare.getD1Database(
        databaseBinding,
        workerName
      )
      const migrationsPath = options.migrationsPath ?? defaultMigrationsPath
      await applyD1Migrations(
        database,
        readD1MigrationPlan({
          migrationsPath,
          throughMigration: options.throughMigration,
        })
      )
      return new RegistryMiniflareHarness(environment, database, migrationsPath)
    } catch (error) {
      await environment.dispose()
      throw error
    }
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

  async migrateAfter(migrationName: string) {
    await applyD1Migrations(
      this.database,
      migrationsAfter(this.#migrationsPath, migrationName)
    )
  }

  async reset() {
    await resetD1Database(this.database)
  }

  async dispose() {
    await this.#environment.dispose()
  }
}
