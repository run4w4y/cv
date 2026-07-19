import { Config, Effect } from 'effect'

type WranglerConfig = {
  readonly $schema: string
  readonly assets: {
    readonly binding: 'ASSETS'
    readonly directory: '.open-next/assets'
  }
  readonly cache: { readonly enabled: true }
  readonly compatibility_date: string
  readonly compatibility_flags: readonly ['nodejs_compat']
  readonly main: 'worker.ts'
  readonly name: string
  readonly observability: { readonly enabled: true }
  readonly preview_urls: false
  readonly services: readonly {
    readonly binding: 'CV_PUBLIC_RESOLVER'
    readonly entrypoint: string
    readonly service: string
  }[]
  readonly workers_dev: true
}

const optionalString = (name: string, fallback: string) =>
  Config.string(name).pipe(
    Config.withDefault(fallback),
    Config.map((value) => value.trim() || fallback)
  )

const readConfig = Effect.all({
  applicationRegistryWorkerName: optionalString(
    'APPLICATION_REGISTRY_WORKER_NAME',
    'cv-application-registry'
  ),
  compatibilityDate: optionalString(
    'CV_PUBLIC_COMPATIBILITY_DATE',
    '2026-07-19'
  ),
  registryEntrypoint: optionalString(
    'CV_PUBLIC_RESOLVER_ENTRYPOINT',
    'CvPublicResolver'
  ),
  registryServiceName: optionalString('CV_PUBLIC_REGISTRY_SERVICE_NAME', ''),
  workerName: optionalString('CV_PUBLIC_WORKER_NAME', 'cv-public'),
}).pipe(
  Effect.map(
    ({
      applicationRegistryWorkerName,
      compatibilityDate,
      registryEntrypoint,
      registryServiceName,
      workerName,
    }) =>
      ({
        $schema: '../../node_modules/wrangler/config-schema.json',
        assets: { binding: 'ASSETS', directory: '.open-next/assets' },
        cache: { enabled: true },
        compatibility_date: compatibilityDate,
        compatibility_flags: ['nodejs_compat'],
        main: 'worker.ts',
        name: workerName,
        observability: { enabled: true },
        preview_urls: false,
        services: [
          {
            binding: 'CV_PUBLIC_RESOLVER',
            entrypoint: registryEntrypoint,
            service: registryServiceName || applicationRegistryWorkerName,
          },
        ],
        workers_dev: true,
      }) satisfies WranglerConfig
  )
)

const program = Effect.gen(function* () {
  const outputPath = process.argv[2]?.trim() || 'apps/cv/wrangler.deploy.jsonc'
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
