import { fileURLToPath } from 'node:url'
import type { D1Database } from '@cloudflare/workers-types'

import {
  applyD1Migrations,
  MiniflareTestEnvironment,
  readD1MigrationPlan,
  resetD1Database,
  resetKVNamespace,
  resetR2Bucket,
  workerTestCompatibilityDate,
} from '../miniflare'
import {
  applicationRegistryBindings,
  applicationRegistryVariables,
  cloudflareAnalyticsTestToken,
  registryTestToken,
} from './bindings'

const defaultMigrationsPath = fileURLToPath(
  new URL('../../../application-registry/entity/drizzle', import.meta.url)
)
const registryWorkerName = 'application-registry-api'
const d1DatabaseId = 'application-registry-test-database'

export type RegistryOutboundService = (
  request: Request
) => Response | Promise<Response>

export type RegistryRequestInit = {
  readonly body?: string | Uint8Array
  readonly headers?: Readonly<Record<string, string>>
  readonly method?: string
}

export interface RegistryWorkerHarnessOptions {
  readonly bindings?: Readonly<Record<string, string>>
  readonly migrationsPath?: string
  readonly outboundService?: RegistryOutboundService
  readonly token?: string
  readonly workerBundlePath: string
}

/** Runs the built registry Worker with its local D1, KV, and R2 services. */
export class RegistryWorkerHarness {
  readonly token: string

  #database: D1Database | undefined
  readonly #environment: MiniflareTestEnvironment
  #registryWorker:
    | Awaited<ReturnType<MiniflareTestEnvironment['miniflare']['getWorker']>>
    | undefined
  #url: URL | undefined

  private constructor(environment: MiniflareTestEnvironment, token: string) {
    this.#environment = environment
    this.token = token
  }

  static async make(options: RegistryWorkerHarnessOptions) {
    const token = options.token ?? registryTestToken
    const environment = await MiniflareTestEnvironment.make(
      {
        compatibilityDate: workerTestCompatibilityDate,
        compatibilityFlags: ['nodejs_compat'],
        workers: [
          {
            bindings: {
              CHATGPT_SESSION_SECRET: 'integration-chatgpt-session-secret',
              CLOUDFLARE_ANALYTICS_API_TOKEN: cloudflareAnalyticsTestToken,
              [applicationRegistryVariables.cloudflareGraphqlEndpoint]:
                'https://cloudflare.test/graphql',
              [applicationRegistryVariables.cloudflareZoneId]: 'zone-id',
              [applicationRegistryVariables.cvWebHost]: 'cv.example.test',
              [applicationRegistryVariables.listingCheckArchiveEnabled]:
                'false',
              [applicationRegistryVariables.listingCheckBatchSize]: '5',
              [applicationRegistryVariables.listingChecksEnabled]: 'true',
              REGISTRY_API_TOKEN: token,
              ...options.bindings,
            },
            d1Databases: {
              [applicationRegistryBindings.database]: d1DatabaseId,
            },
            kvNamespaces: {
              [applicationRegistryBindings.sessions]: 'chatgpt-sessions',
            },
            modules: true,
            name: registryWorkerName,
            ...(options.outboundService
              ? { outboundService: options.outboundService }
              : {}),
            r2Buckets: {
              [applicationRegistryBindings.objects]: 'cv-objects',
            },
            scriptPath: options.workerBundlePath,
            unsafeDirectSockets: [{ port: 0 }],
          },
        ],
      },
      {
        persist: ['d1', 'kv', 'r2'],
        temporaryDirectoryPrefix: 'application-registry-worker-test-',
      }
    )
    const harness = new RegistryWorkerHarness(environment, token)

    try {
      await harness.#connect()
      await applyD1Migrations(
        harness.database,
        readD1MigrationPlan({
          migrationsPath: options.migrationsPath ?? defaultMigrationsPath,
        })
      )
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

  get persistPath() {
    if (this.#environment.persistPath === undefined) {
      throw new Error('The registry Worker harness is not persisted.')
    }
    return this.#environment.persistPath
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
    await this.#environment.restart()
    this.#database = undefined
    this.#registryWorker = undefined
    this.#url = undefined
    await this.#connect()
  }

  async reset() {
    await resetD1Database(this.database)
    const [sessions, objects] = await Promise.all([
      this.#environment.miniflare.getKVNamespace(
        applicationRegistryBindings.sessions,
        registryWorkerName
      ),
      this.#environment.miniflare.getR2Bucket(
        applicationRegistryBindings.objects,
        registryWorkerName
      ),
    ])
    await Promise.all([resetKVNamespace(sessions), resetR2Bucket(objects)])
  }

  async dispose() {
    this.#database = undefined
    this.#registryWorker = undefined
    this.#url = undefined
    await this.#environment.dispose()
  }

  async #connect() {
    const miniflare = this.#environment.miniflare
    this.#registryWorker = await miniflare.getWorker(registryWorkerName)
    this.#url = await miniflare.unsafeGetDirectURL(registryWorkerName)
    this.#database = await miniflare.getD1Database(
      applicationRegistryBindings.database,
      registryWorkerName
    )
  }
}
