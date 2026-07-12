import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { Schema } from 'effect'
import { Miniflare } from 'miniflare'

const workspaceRoot = fileURLToPath(new URL('../../../../../', import.meta.url))
const defaultMigrationsPath = join(
  workspaceRoot,
  'libs/application-registry/entity/drizzle'
)

const adminWorker = `
const respond = (value, status = 200) => Response.json(value, { status })
export default {
  async fetch(request, env) {
    try {
      const operation = await request.json()
      if (operation.mode === 'batch') {
        const statements = operation.statements.map(({ sql, parameters }) =>
          env.DB.prepare(sql).bind(...parameters)
        )
        return respond(await env.DB.batch(statements))
      }
      const statement = env.DB.prepare(operation.sql).bind(...operation.parameters)
      return respond(await statement.all())
    } catch (error) {
      return respond({ error: error instanceof Error ? error.message : String(error) }, 500)
    }
  }
}
`

type Statement = {
  readonly parameters: readonly (string | number | null)[]
  readonly sql: string
}

export interface RegistryMiniflareHarnessOptions {
  readonly databaseBinding: string
  readonly databaseId?: string
  readonly migrationsPath?: string
  readonly workerBundlePath: string
  readonly workerName: string
}

export class RegistryMiniflareHarness {
  readonly #miniflare: Miniflare
  readonly #persistPath: string
  readonly #worker: Awaited<ReturnType<Miniflare['getWorker']>>
  readonly #adminUrl: URL
  readonly #migrationsPath: string

  private constructor(
    miniflare: Miniflare,
    persistPath: string,
    worker: Awaited<ReturnType<Miniflare['getWorker']>>,
    adminUrl: URL,
    migrationsPath: string
  ) {
    this.#miniflare = miniflare
    this.#persistPath = persistPath
    this.#worker = worker
    this.#adminUrl = adminUrl
    this.#migrationsPath = migrationsPath
  }

  static async make(options: RegistryMiniflareHarnessOptions) {
    const persistPath = await mkdtemp(join(tmpdir(), 'application-registry-'))
    const databaseId = options.databaseId ?? `${options.workerName}-test`
    const miniflare = new Miniflare({
      compatibilityDate: '2026-06-22',
      d1Persist: persistPath,
      workers: [
        {
          d1Databases: { [options.databaseBinding]: databaseId },
          modules: true,
          name: options.workerName,
          scriptPath: options.workerBundlePath,
          unsafeDirectSockets: [{ port: 0 }],
        },
        {
          d1Databases: { DB: databaseId },
          modules: true,
          name: `${options.workerName}-admin`,
          script: adminWorker,
          unsafeDirectSockets: [{ port: 0 }],
        },
      ],
    })

    await miniflare.ready
    const harness = new RegistryMiniflareHarness(
      miniflare,
      persistPath,
      await miniflare.getWorker(options.workerName),
      await miniflare.unsafeGetDirectURL(`${options.workerName}-admin`),
      options.migrationsPath ?? defaultMigrationsPath
    )
    await harness.#migrate()
    return harness
  }

  fetch(path: string) {
    return this.#worker.fetch(new URL(path, 'https://registry.test'))
  }

  async fetchJson<A>(
    schema: Schema.ConstraintDecoder<A>,
    path: string
  ): Promise<A> {
    const response = await this.fetch(path)
    const body = await response.json()
    if (!response.ok) throw new Error(JSON.stringify(body))
    return Schema.decodeUnknownSync(schema)(body)
  }

  async query<A>(
    rowSchema: Schema.ConstraintDecoder<A>,
    sql: string,
    parameters: Statement['parameters'] = []
  ): Promise<readonly A[]> {
    const response = await fetch(this.#adminUrl, {
      body: JSON.stringify({ mode: 'all', parameters, sql }),
      method: 'POST',
    })
    const body = await response.json()
    if (!response.ok) throw new Error(JSON.stringify(body))
    const result = Schema.decodeUnknownSync(
      Schema.Struct({ results: Schema.Array(rowSchema) })
    )(body)
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
        .map((sql) => ({ parameters: [], sql }))
    )
    const response = await fetch(this.#adminUrl, {
      body: JSON.stringify({ mode: 'batch', statements }),
      method: 'POST',
    })
    if (!response.ok) throw new Error(await response.text())
  }
}
