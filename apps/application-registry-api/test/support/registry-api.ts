import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import {
  type StartedMinioTestContainer,
  startMinioTestContainer,
} from '@cv/test-infrastructure/minio'
import {
  type StartedNatsTestContainer,
  startNatsTestContainer,
} from '@cv/test-infrastructure/nats'
import {
  type StartedPostgresTestContainer,
  startPostgresTestContainer,
} from '@cv/test-infrastructure/postgres'
import { PgClient } from '@effect/sql-pg'
import { Effect, ManagedRuntime, Redacted } from 'effect'

const workspaceRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const migrationPath = fileURLToPath(
  new URL(
    '../../../../libs/application-registry/entity/drizzle/20260721150524_registry_baseline/migration.sql',
    import.meta.url
  )
)
const apiEntryPath = fileURLToPath(
  new URL('../../dist/main.js', import.meta.url)
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
  'registry_sequence',
] as const

const factsBucket = 'cv-facts'
const objectsBucket = 'cv-objects'

export const registryTestToken = 'registry-test-token'
export const factsPublishTestToken = 'facts-publish-test-token'

const makePostgresRuntime = (postgres: StartedPostgresTestContainer) =>
  ManagedRuntime.make(
    PgClient.layer({
      applicationName: 'application-registry-api-integration',
      database: postgres.database,
      host: postgres.host,
      maxConnections: 1,
      password: Redacted.make(postgres.password),
      port: postgres.port,
      username: postgres.username,
    })
  )

type PostgresRuntime = ReturnType<typeof makePostgresRuntime>

const availablePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate a test port.')))
        return
      }
      server.close((error) =>
        error === undefined ? resolve(address.port) : reject(error)
      )
    })
  })

const emptyBucket = async (client: S3Client, bucket: string) => {
  let continuationToken: string | undefined
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    )
    const objects = listed.Contents?.flatMap(({ Key }) =>
      Key === undefined ? [] : [{ Key }]
    )
    if (objects !== undefined && objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects, Quiet: true },
        })
      )
    }
    continuationToken = listed.NextContinuationToken
  } while (continuationToken !== undefined)
}

const waitForApiReady = (
  process: ChildProcessWithoutNullStreams,
  output: string[]
) =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(`Registry API did not become ready.\n${output.join('')}`)
      )
    }, 30_000)
    const complete = (result: () => void) => {
      clearTimeout(timeout)
      process.stdout.off('data', onStdout)
      process.off('exit', onExit)
      result()
    }
    const onStdout = (chunk: Buffer) => {
      const text = chunk.toString()
      output.push(text)
      if (text.includes('"service":"application-registry-api"')) {
        complete(resolve)
      }
    }
    const onExit = (code: number | null) =>
      complete(() =>
        reject(
          new Error(
            `Registry API exited before readiness with code ${String(code)}.\n${output.join('')}`
          )
        )
      )
    process.stdout.on('data', onStdout)
    process.once('exit', onExit)
  })

export class RegistryApiHarness {
  readonly factsToken = factsPublishTestToken
  readonly token = registryTestToken

  readonly #minio: StartedMinioTestContainer
  readonly #nats: StartedNatsTestContainer
  readonly #postgres: StartedPostgresTestContainer
  readonly #postgresRuntime: PostgresRuntime
  readonly #s3: S3Client
  #apiProcess: ChildProcessWithoutNullStreams | undefined
  #url: URL | undefined

  private constructor(
    minio: StartedMinioTestContainer,
    nats: StartedNatsTestContainer,
    postgres: StartedPostgresTestContainer,
    postgresRuntime: PostgresRuntime,
    s3: S3Client
  ) {
    this.#minio = minio
    this.#nats = nats
    this.#postgres = postgres
    this.#postgresRuntime = postgresRuntime
    this.#s3 = s3
  }

  static async make(): Promise<RegistryApiHarness> {
    const postgres = await startPostgresTestContainer({
      database: 'application_registry',
      initScriptPath: migrationPath,
      password: 'registry-test',
      username: 'registry',
    })
    let minio: StartedMinioTestContainer
    try {
      minio = await startMinioTestContainer()
    } catch (error) {
      await postgres.dispose()
      throw error
    }
    let nats: StartedNatsTestContainer
    try {
      nats = await startNatsTestContainer({
        topology: {
          streams: [
            {
              name: 'REGISTRY_EVENTS',
              subjects: ['registry.events.>'],
            },
          ],
        },
      })
    } catch (error) {
      await Promise.allSettled([minio.dispose(), postgres.dispose()])
      throw error
    }
    const s3 = new S3Client({
      credentials: {
        accessKeyId: minio.accessKeyId,
        secretAccessKey: minio.secretAccessKey,
      },
      endpoint: minio.endpoint.href,
      forcePathStyle: minio.forcePathStyle,
      region: minio.region,
    })
    const postgresRuntime = makePostgresRuntime(postgres)
    const harness = new RegistryApiHarness(
      minio,
      nats,
      postgres,
      postgresRuntime,
      s3
    )

    try {
      await Promise.all([
        s3.send(new CreateBucketCommand({ Bucket: factsBucket })),
        s3.send(new CreateBucketCommand({ Bucket: objectsBucket })),
      ])
      await harness.start()
      return harness
    } catch (error) {
      await harness.dispose()
      throw error
    }
  }

  get url(): URL {
    if (this.#url === undefined) {
      throw new Error('The registry API harness is not running.')
    }
    return this.#url
  }

  fetchRegistry(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${this.token}`)
    return fetch(new URL(path, this.url), { ...init, headers })
  }

  async start(): Promise<void> {
    if (this.#apiProcess !== undefined) return
    const port = await availablePort()
    const output: string[] = []
    const apiProcess = spawn('bun', [apiEntryPath], {
      cwd: workspaceRoot,
      env: {
        PATH: process.env.PATH ?? '',
        NODE_ENV: 'test',
        CLOUDFLARE_ANALYTICS_API_TOKEN: 'analytics-test-token',
        CLOUDFLARE_GRAPHQL_ENDPOINT: 'http://127.0.0.1:1/graphql',
        CLOUDFLARE_ZONE_ID: 'zone-test',
        CV_WEB_HOST: 'cv.example.test',
        FACTS_PUBLISH_TOKEN: factsPublishTestToken,
        MINIO_ACCESS_KEY_ID: this.#minio.accessKeyId,
        MINIO_ENDPOINT: this.#minio.endpoint.href,
        MINIO_FACTS_BUCKET: factsBucket,
        MINIO_FORCE_PATH_STYLE: 'true',
        MINIO_OBJECTS_BUCKET: objectsBucket,
        MINIO_REGION: this.#minio.region,
        MINIO_SECRET_ACCESS_KEY: this.#minio.secretAccessKey,
        NATS_PASSWORD: this.#nats.password,
        NATS_SERVER: this.#nats.server,
        NATS_USER: this.#nats.username,
        POSTGRES_DATABASE: this.#postgres.database,
        POSTGRES_HOST: this.#postgres.host,
        POSTGRES_MAX_CONNECTIONS: '4',
        POSTGRES_PASSWORD: this.#postgres.password,
        POSTGRES_PORT: String(this.#postgres.port),
        POSTGRES_USER: this.#postgres.username,
        REGISTRY_API_TOKEN: registryTestToken,
        REGISTRY_CORS_ALLOWED_ORIGINS: 'https://cv-registry.example.test',
        SERVER_HOST: '127.0.0.1',
        SERVER_PORT: String(port),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    apiProcess.stdin.end()
    apiProcess.stderr.on('data', (chunk: Buffer) =>
      output.push(chunk.toString())
    )
    this.#apiProcess = apiProcess
    this.#url = new URL(`http://127.0.0.1:${port}`)
    try {
      await waitForApiReady(apiProcess, output)
    } catch (error) {
      await this.stop()
      throw error
    }
  }

  async stop(): Promise<void> {
    const apiProcess = this.#apiProcess
    this.#apiProcess = undefined
    this.#url = undefined
    if (apiProcess === undefined || apiProcess.exitCode !== null) return
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        apiProcess.kill('SIGKILL')
      }, 10_000)
      apiProcess.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
      apiProcess.kill('SIGTERM')
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  async reset(): Promise<void> {
    await this.#postgresRuntime.runPromise(
      Effect.gen(function* () {
        const client = yield* PgClient.PgClient
        yield* client.unsafe(
          `truncate table ${tableNames.map((name) => `"${name}"`).join(', ')} cascade`
        )
      })
    )
    await Promise.all([
      emptyBucket(this.#s3, factsBucket),
      emptyBucket(this.#s3, objectsBucket),
    ])
  }

  async dispose(): Promise<void> {
    await this.stop()
    this.#s3.destroy()
    await this.#postgresRuntime.dispose()
    await Promise.allSettled([
      this.#minio.dispose(),
      this.#nats.dispose(),
      this.#postgres.dispose(),
    ])
  }
}
