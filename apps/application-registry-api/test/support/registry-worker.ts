import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { Miniflare } from 'miniflare'

const workspaceRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const applicationRoot = join(workspaceRoot, 'apps', 'application-registry-api')
const workerBundlePath = join(applicationRoot, 'dist', 'index.js')
const migrationsPath = join(
  workspaceRoot,
  'libs',
  'application-registry',
  'entity',
  'drizzle'
)
const registryWorkerName = 'application-registry-api'
const d1AdminWorkerName = 'application-registry-test-d1'
const d1DatabaseId = 'application-registry-test-database'

// Keep test SQL inside workerd: Miniflare's Node-side D1 capability proxy hangs
// in the pinned release. Both Workers still use the same real named D1 binding.
const d1AdminWorker = `
const response = (value, status = 200) =>
  Response.json(value, { status })

export default {
  async fetch(request, env) {
    try {
      const operation = await request.json()
      if (operation.mode === 'batch') {
        const statements = operation.statements.map(({ sql, parameters }) =>
          env.APPLICATION_REGISTRY_DB.prepare(sql).bind(...parameters)
        )
        return response({ value: await env.APPLICATION_REGISTRY_DB.batch(statements) })
      }

      const statement = env.APPLICATION_REGISTRY_DB
        .prepare(operation.sql)
        .bind(...operation.parameters)
      const value = operation.mode === 'all'
        ? await statement.all()
        : operation.mode === 'first'
          ? await statement.first()
          : await statement.run()
      return response({ value })
    } catch (error) {
      return response({
        error: error instanceof Error ? error.message : String(error),
      }, 500)
    }
  },
}
`

export const registryTestToken = 'application-registry-e2e-token'

type D1Value = string | number | null

type RegistryRequestInit = {
  readonly body?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly method?: string
}

type D1Operation =
  | {
      readonly mode: 'all' | 'first' | 'run'
      readonly parameters: readonly D1Value[]
      readonly sql: string
    }
  | {
      readonly mode: 'batch'
      readonly statements: readonly {
        readonly parameters: readonly D1Value[]
        readonly sql: string
      }[]
    }

type RegistryD1Result<Row> = {
  readonly meta: Readonly<Record<string, unknown>>
  readonly results: readonly Row[]
  readonly success: boolean
}

class RegistryD1Statement {
  constructor(
    private readonly execute: <Result>(
      operation: D1Operation
    ) => Promise<Result>,
    readonly sql: string,
    readonly parameters: readonly D1Value[] = []
  ) {}

  bind(...parameters: readonly D1Value[]) {
    return new RegistryD1Statement(this.execute, this.sql, parameters)
  }

  all<Row>() {
    return this.execute<RegistryD1Result<Row>>({
      mode: 'all',
      parameters: this.parameters,
      sql: this.sql,
    })
  }

  first<Row>() {
    return this.execute<Row | null>({
      mode: 'first',
      parameters: this.parameters,
      sql: this.sql,
    })
  }

  run<Row = never>() {
    return this.execute<RegistryD1Result<Row>>({
      mode: 'run',
      parameters: this.parameters,
      sql: this.sql,
    })
  }
}

export class RegistryD1Database {
  constructor(
    private readonly execute: <Result>(
      operation: D1Operation
    ) => Promise<Result>
  ) {}

  prepare(sql: string) {
    return new RegistryD1Statement(this.execute, sql)
  }

  batch(statements: readonly RegistryD1Statement[]) {
    return this.execute<readonly RegistryD1Result<unknown>[]>({
      mode: 'batch',
      statements: statements.map(({ parameters, sql }) => ({
        parameters,
        sql,
      })),
    })
  }
}

const applyMigrations = async (database: RegistryD1Database) => {
  const migrations = readMigrationFiles({ migrationsFolder: migrationsPath })
  if (migrations.length === 0) {
    throw new Error(`No registry migrations found in ${migrationsPath}.`)
  }

  for (const migration of migrations) {
    const statements = migration.sql
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement))

    if (statements.length > 0) {
      await database.batch(statements)
    }
  }
}

export class RegistryWorkerHarness {
  readonly persistPath: string
  readonly token: string

  #database: RegistryD1Database | undefined
  #d1AdminUrl: URL | undefined
  #miniflare: Miniflare | undefined
  #registryWorker: Awaited<ReturnType<Miniflare['getWorker']>> | undefined
  #url: URL | undefined

  private constructor(persistPath: string, token: string) {
    this.persistPath = persistPath
    this.token = token
  }

  static async make(token = registryTestToken) {
    const persistPath = await mkdtemp(
      join(tmpdir(), 'application-registry-miniflare-')
    )
    const harness = new RegistryWorkerHarness(persistPath, token)
    try {
      await harness.#start(true)
      return harness
    } catch (error) {
      await harness.dispose()
      throw error
    }
  }

  get database() {
    if (this.#database === undefined) {
      throw new Error('The registry Worker harness is not running.')
    }

    return this.#database
  }

  get url() {
    if (this.#url === undefined) {
      throw new Error('The registry Worker harness is not running.')
    }

    return this.#url
  }

  async fetchRegistry(path: string, init: RegistryRequestInit = {}) {
    if (this.#registryWorker === undefined) {
      throw new Error('The registry Worker harness is not running.')
    }

    return this.#registryWorker.fetch(
      new URL(path, 'https://application-registry.test'),
      {
        ...init,
        headers: {
          ...init.headers,
          authorization: `Bearer ${this.token}`,
        },
      }
    )
  }

  async restart() {
    await this.#disposeMiniflare()
    await this.#start(false)
  }

  async dispose() {
    await this.#disposeMiniflare()
    await rm(this.persistPath, { force: true, recursive: true })
  }

  async #start(migrate: boolean) {
    const miniflare = new Miniflare({
      compatibilityDate: '2026-06-22',
      d1Persist: this.persistPath,
      workers: [
        {
          bindings: { REGISTRY_API_TOKEN: this.token },
          d1Databases: { APPLICATION_REGISTRY_DB: d1DatabaseId },
          modules: true,
          name: registryWorkerName,
          scriptPath: workerBundlePath,
          unsafeDirectSockets: [{ port: 0 }],
        },
        {
          d1Databases: { APPLICATION_REGISTRY_DB: d1DatabaseId },
          modules: true,
          name: d1AdminWorkerName,
          script: d1AdminWorker,
          unsafeDirectSockets: [{ port: 0 }],
        },
      ],
    })

    this.#miniflare = miniflare
    await miniflare.ready
    this.#registryWorker = await miniflare.getWorker(registryWorkerName)
    this.#url = await miniflare.unsafeGetDirectURL(registryWorkerName)
    this.#d1AdminUrl = await miniflare.unsafeGetDirectURL(d1AdminWorkerName)
    this.#database = new RegistryD1Database((operation) =>
      this.#executeD1(operation)
    )

    if (migrate) {
      await applyMigrations(this.#database)
    }
  }

  async #executeD1<Result>(operation: D1Operation): Promise<Result> {
    if (this.#d1AdminUrl === undefined) {
      throw new Error('The registry D1 test binding is not running.')
    }

    const response = await fetch(this.#d1AdminUrl, {
      body: JSON.stringify(operation),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error(
        `Registry D1 test operation failed: ${await response.text()}`
      )
    }

    const body: { readonly value: Result } = await response.json()
    return body.value
  }

  async #disposeMiniflare() {
    await this.#miniflare?.dispose()
    this.#database = undefined
    this.#d1AdminUrl = undefined
    this.#miniflare = undefined
    this.#registryWorker = undefined
    this.#url = undefined
  }
}
