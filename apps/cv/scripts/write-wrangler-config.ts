import { dirname, resolve } from 'node:path'

type ServiceBinding = {
  readonly binding: string
  readonly entrypoint?: string
  readonly service: string
}

type GeneratedWranglerConfig = Record<string, unknown> & {
  readonly assets?: {
    readonly binding?: string
    readonly directory?: string
    readonly run_worker_first?: boolean | readonly string[]
  }
  readonly main?: string
  readonly no_bundle?: boolean
  readonly rules?: unknown
  readonly services?: readonly ServiceBinding[]
}

const generatedConfigPath = 'apps/cv/dist/server/wrangler.json'
const defaultOutputPath = 'apps/cv/dist/server/wrangler.deploy.json'

const optionalString = (name: string, fallback: string) =>
  process.env[name]?.trim() || fallback

const compatibilityDate = optionalString(
  'CV_PUBLIC_COMPATIBILITY_DATE',
  '2026-06-22'
)
const registryServiceName = optionalString(
  'CV_PUBLIC_REGISTRY_SERVICE_NAME',
  optionalString('APPLICATION_REGISTRY_WORKER_NAME', 'cv-application-registry')
)
const registryEntrypoint = optionalString(
  'CV_PUBLIC_RESOLVER_ENTRYPOINT',
  'CvPublicResolver'
)
const workerName = optionalString('CV_PUBLIC_WORKER_NAME', 'cv-public')
const outputPath = process.argv[2]?.trim() || defaultOutputPath

if (!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate)) {
  throw new Error(
    'CV_PUBLIC_COMPATIBILITY_DATE must use the YYYY-MM-DD format.'
  )
}

if (resolve(dirname(outputPath)) !== resolve(dirname(generatedConfigPath))) {
  throw new Error(
    `The production Wrangler config must remain beside ${generatedConfigPath} so its entrypoint and asset paths stay exact.`
  )
}

const sourceFile = Bun.file(generatedConfigPath)
if (!(await sourceFile.exists())) {
  throw new Error(
    `${generatedConfigPath} does not exist. Build the Astro application first.`
  )
}

const source = (await sourceFile.json()) as GeneratedWranglerConfig
const expectedAssets = {
  binding: 'ASSETS',
  directory: '../client',
  run_worker_first: true,
} as const

if (
  source.main !== 'entry.mjs' ||
  source.no_bundle !== true ||
  source.assets?.binding !== expectedAssets.binding ||
  source.assets.directory !== expectedAssets.directory ||
  source.assets.run_worker_first !== expectedAssets.run_worker_first
) {
  throw new Error(
    `${generatedConfigPath} does not match the expected Astro Worker entrypoint and asset layout.`
  )
}

const productionConfig = {
  ...source,
  configPath: undefined,
  definedEnvironments: undefined,
  dev: undefined,
  topLevelName: undefined,
  userConfigPath: undefined,
  $schema: '../../../../node_modules/wrangler/config-schema.json',
  assets: expectedAssets,
  compatibility_date: compatibilityDate,
  main: './entry.mjs',
  name: workerName,
  observability: { enabled: true },
  preview_urls: false,
  services: [
    {
      binding: 'CV_PUBLIC_RESOLVER',
      service: registryServiceName,
      entrypoint: registryEntrypoint,
    },
  ],
  workers_dev: true,
} satisfies GeneratedWranglerConfig

await Bun.write(outputPath, `${JSON.stringify(productionConfig, null, 2)}\n`)
