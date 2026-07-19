import { Config, Effect } from 'effect'

type QueueConsumer = {
  readonly queue: string
  readonly max_batch_size: 1
  readonly max_batch_timeout: 5
  readonly max_retries: 5
  readonly max_concurrency: 1
  readonly dead_letter_queue?: string
}

type WranglerConfig = {
  readonly $schema: string
  readonly browser: { readonly binding: 'BROWSER' }
  readonly compatibility_date: string
  readonly compatibility_flags: readonly ['nodejs_compat']
  readonly d1_databases: readonly {
    readonly binding: 'APPLICATION_REGISTRY_DB'
    readonly database_id: string
    readonly database_name: string
    readonly migrations_dir: '../../libs/application-registry/entity/drizzle'
    readonly migrations_pattern: '../../libs/application-registry/entity/drizzle/*/migration.sql'
  }[]
  readonly main: './dist/index.js'
  readonly name: string
  readonly observability: { readonly enabled: true }
  readonly preview_urls: false
  readonly queues: { readonly consumers: readonly QueueConsumer[] }
  readonly r2_buckets: readonly {
    readonly binding: 'CV_OBJECTS'
    readonly bucket_name: string
  }[]
  readonly vars: { readonly CV_PDF_DLQ_NAME: string }
  readonly workers_dev: false
}

const defaultOutputPath = 'apps/cv-pdf-worker/wrangler.deploy.jsonc'

const optionalString = (name: string, fallback: string) =>
  Config.string(name).pipe(
    Config.withDefault(fallback),
    Config.map((value) => value.trim() || fallback)
  )

const readConfig = Effect.all({
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
  pdfDeadLetterQueueName: optionalString(
    'CV_PDF_DLQ_NAME',
    'cv-pdf-generation-dead-letter'
  ),
  pdfQueueName: optionalString('CV_PDF_QUEUE_NAME', 'cv-pdf-generation'),
  workerName: optionalString('CV_PDF_WORKER_NAME', 'cv-pdf-worker'),
}).pipe(
  Effect.map(
    ({
      compatibilityDate,
      cvObjectsBucketName,
      databaseId,
      databaseName,
      pdfDeadLetterQueueName,
      pdfQueueName,
      workerName,
    }) =>
      ({
        $schema: '../../node_modules/wrangler/config-schema.json',
        browser: { binding: 'BROWSER' },
        compatibility_date: compatibilityDate,
        compatibility_flags: ['nodejs_compat'],
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
        main: './dist/index.js',
        name: workerName,
        observability: { enabled: true },
        preview_urls: false,
        queues: {
          consumers: [
            {
              queue: pdfQueueName,
              max_batch_size: 1,
              max_batch_timeout: 5,
              max_retries: 5,
              dead_letter_queue: pdfDeadLetterQueueName,
              max_concurrency: 1,
            },
            {
              queue: pdfDeadLetterQueueName,
              max_batch_size: 1,
              max_batch_timeout: 5,
              max_retries: 5,
              max_concurrency: 1,
            },
          ],
        },
        r2_buckets: [
          {
            binding: 'CV_OBJECTS',
            bucket_name: cvObjectsBucketName,
          },
        ],
        vars: { CV_PDF_DLQ_NAME: pdfDeadLetterQueueName },
        workers_dev: false,
      }) satisfies WranglerConfig
  )
)

const program = Effect.gen(function* () {
  const outputPath = process.argv[2]?.trim() || defaultOutputPath
  const config = yield* readConfig
  yield* Effect.tryPromise({
    try: () => Bun.write(outputPath, `${JSON.stringify(config, null, 2)}\n`),
    catch: (cause) => new Error(`Failed to write ${outputPath}`, { cause }),
  })
})

Effect.runPromise(program).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
