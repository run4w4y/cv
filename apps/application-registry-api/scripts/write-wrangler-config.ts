import { Config, Effect, Option } from 'effect'

type WranglerConfig = {
  readonly $schema: string
  readonly compatibility_date: string
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
  readonly secrets: { readonly required: readonly ['REGISTRY_API_TOKEN'] }
  readonly workers_dev: true
}

const defaultOutputPath = 'apps/application-registry-api/wrangler.deploy.jsonc'

const optionalString = (name: string, fallback: string) =>
  Config.nonEmptyString(name).pipe(
    Config.option,
    Config.map(Option.getOrElse(() => fallback))
  )

const readOutputPath = Effect.sync(
  () => process.argv[2]?.trim() || defaultOutputPath
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
  workerName: optionalString(
    'APPLICATION_REGISTRY_WORKER_NAME',
    'cv-application-registry'
  ),
}).pipe(
  Effect.map(
    ({ compatibilityDate, databaseId, databaseName, workerName }) =>
      ({
        $schema: '../../node_modules/wrangler/config-schema.json',
        compatibility_date: compatibilityDate,
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
        secrets: { required: ['REGISTRY_API_TOKEN'] },
        workers_dev: true,
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
