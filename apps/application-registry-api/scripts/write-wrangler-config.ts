import { Config, Effect } from 'effect'

import { applicationRegistryWorkersDevEnabled } from './deployment-config'

type WranglerConfig = {
  readonly $schema: string
  readonly assets: {
    readonly binding: 'ASSETS'
    readonly directory: '../application-registry/dist'
    readonly not_found_handling: 'single-page-application'
    readonly run_worker_first: readonly [
      '/api/*',
      '/v1/*',
      '/health',
      '/openapi.json',
    ]
  }
  readonly compatibility_date: string
  readonly compatibility_flags: readonly ['nodejs_compat']
  readonly browser: { readonly binding: 'BROWSER' }
  readonly d1_databases: readonly {
    readonly binding: 'APPLICATION_REGISTRY_DB'
    readonly database_id: string
    readonly database_name: string
    readonly migrations_dir: '../../libs/application-registry/entity/drizzle'
    readonly migrations_pattern: '../../libs/application-registry/entity/drizzle/*/migration.sql'
  }[]
  readonly kv_namespaces: readonly {
    readonly binding: 'CHATGPT_SESSIONS'
    readonly id: string
  }[]
  readonly main: './dist/index.js'
  readonly name: string
  readonly observability: { readonly enabled: true }
  readonly preview_urls: false
  readonly r2_buckets: readonly {
    readonly binding: 'CV_OBJECTS'
    readonly bucket_name: string
  }[]
  readonly secrets: {
    readonly required: readonly ['CHATGPT_SESSION_SECRET', 'REGISTRY_API_TOKEN']
  }
  readonly triggers: { readonly crons: readonly ['17 * * * *'] }
  readonly vars: {
    readonly LISTING_CHECKS_ENABLED: 'true'
    readonly LISTING_CHECK_ARCHIVE_ENABLED: 'false'
    readonly LISTING_CHECK_BATCH_SIZE: '5'
  }
  readonly workers_dev: boolean
  readonly workflows: readonly {
    readonly binding: 'CV_PDF_WORKFLOW'
    readonly class_name: 'CvPdfWorkflow'
    readonly name: string
  }[]
}

const defaultOutputPath = 'apps/application-registry-api/wrangler.deploy.jsonc'

const optionalString = (name: string, fallback: string) =>
  Config.string(name).pipe(
    Config.withDefault(fallback),
    Config.map((value) => value.trim() || fallback)
  )

const readOutputPath = Effect.sync(
  () => process.argv[2]?.trim() || defaultOutputPath
)

const readConfig = Effect.all({
  chatgptSessionsKvId: Config.nonEmptyString('CHATGPT_SESSIONS_KV_ID'),
  compatibilityDate: optionalString(
    'APPLICATION_REGISTRY_COMPATIBILITY_DATE',
    '2026-06-22'
  ),
  databaseId: Config.nonEmptyString('APPLICATION_REGISTRY_DB_ID'),
  databaseName: optionalString(
    'APPLICATION_REGISTRY_DB_NAME',
    'cv-application-registry'
  ),
  cvObjectsBucketName: optionalString('CV_OBJECTS_BUCKET_NAME', 'cv-objects'),
  pdfWorkflowName: optionalString('CV_PDF_WORKFLOW_NAME', 'cv-pdf'),
  workersDev: applicationRegistryWorkersDevEnabled,
  workerName: optionalString(
    'APPLICATION_REGISTRY_WORKER_NAME',
    'cv-application-registry'
  ),
}).pipe(
  Effect.map(
    ({
      chatgptSessionsKvId,
      compatibilityDate,
      cvObjectsBucketName,
      databaseId,
      databaseName,
      pdfWorkflowName,
      workersDev,
      workerName,
    }) =>
      ({
        $schema: '../../node_modules/wrangler/config-schema.json',
        assets: {
          binding: 'ASSETS',
          directory: '../application-registry/dist',
          not_found_handling: 'single-page-application',
          run_worker_first: ['/api/*', '/v1/*', '/health', '/openapi.json'],
        },
        compatibility_date: compatibilityDate,
        compatibility_flags: ['nodejs_compat'],
        browser: { binding: 'BROWSER' },
        d1_databases: [
          {
            binding: 'APPLICATION_REGISTRY_DB',
            database_id: databaseId,
            database_name: databaseName,
            migrations_dir: '../../libs/application-registry/entity/drizzle',
            migrations_pattern:
              '../../libs/application-registry/entity/drizzle/*/migration.sql',
          },
        ],
        kv_namespaces: [
          {
            binding: 'CHATGPT_SESSIONS',
            id: chatgptSessionsKvId,
          },
        ],
        main: './dist/index.js',
        name: workerName,
        observability: { enabled: true },
        preview_urls: false,
        r2_buckets: [
          {
            binding: 'CV_OBJECTS',
            bucket_name: cvObjectsBucketName,
          },
        ],
        secrets: {
          required: ['CHATGPT_SESSION_SECRET', 'REGISTRY_API_TOKEN'],
        },
        triggers: { crons: ['17 * * * *'] },
        vars: {
          LISTING_CHECKS_ENABLED: 'true',
          LISTING_CHECK_ARCHIVE_ENABLED: 'false',
          LISTING_CHECK_BATCH_SIZE: '5',
        },
        workers_dev: workersDev,
        workflows: [
          {
            binding: 'CV_PDF_WORKFLOW',
            class_name: 'CvPdfWorkflow',
            name: pdfWorkflowName,
          },
        ],
      }) satisfies WranglerConfig
  )
)

const program = Effect.gen(function* () {
  const [outputPath, config] = yield* Effect.all([readOutputPath, readConfig])

  yield* Effect.tryPromise({
    try: () => Bun.write(outputPath, `${JSON.stringify(config, null, 2)}\n`),
    catch: (cause) => new Error(`Failed to write ${outputPath}`, { cause }),
  })
})

Effect.runPromise(program).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
