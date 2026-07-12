import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Config, ConfigProvider, Console, Data, Effect, Option } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'

import {
  type AnalyticsConnectorConfigError,
  analyticsFallbackEnv,
  cacheTtlSecondsEnv,
  cloudflareGraphqlEndpointEnv,
  cloudflareZoneIdEnv,
  configProviderFromRecord,
  cvWebHostEnv,
  readAnalyticsFallback,
  readCacheTtlSeconds,
  readCloudflareGraphqlEndpoint,
} from '../src/worker/config'

type WranglerConfig = {
  readonly $schema: string
  readonly compatibility_date: string
  readonly main: string
  readonly name: string
  readonly observability: {
    readonly enabled: boolean
  }
  readonly preview_urls: false
  readonly vars: Readonly<Record<string, string>>
  readonly workers_dev: true
}

class WranglerConfigError extends Data.TaggedError('WranglerConfigError')<{
  readonly cause?: unknown
  readonly message: string
}> {
  static fromConfigError(cause: Config.ConfigError) {
    return new WranglerConfigError({
      cause,
      message: cause.message,
    })
  }

  static fromConnectorConfig(cause: AnalyticsConnectorConfigError) {
    return new WranglerConfigError({
      cause,
      message: cause.message,
    })
  }
}

const defaultOutputPath = 'apps/analytics-connector/wrangler.deploy.jsonc'
const compatibilityDateEnv = 'ANALYTICS_CONNECTOR_COMPATIBILITY_DATE'
const workerNameEnv = 'ANALYTICS_CONNECTOR_WORKER_NAME'

const requiredStringConfig = (name: string) =>
  Config.nonEmptyString(name).pipe(
    Effect.mapError(WranglerConfigError.fromConfigError)
  )

const optionalStringConfig = (name: string, fallback: string) =>
  Config.nonEmptyString(name).pipe(
    Config.option,
    Effect.map(Option.getOrElse(() => fallback)),
    Effect.mapError(WranglerConfigError.fromConfigError)
  )

const withProcessConfig = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      configProviderFromRecord(process.env)
    )
  )

const readOutputPath = Effect.sync(
  () => process.argv[2]?.trim() || defaultOutputPath
)

const readConnectorConfig = <A>(
  effect: Effect.Effect<A, AnalyticsConnectorConfigError>
) => effect.pipe(Effect.mapError(WranglerConfigError.fromConnectorConfig))

const readWranglerConfig = Effect.all({
  analyticsFallback: readConnectorConfig(readAnalyticsFallback),
  cacheTtlSeconds: readConnectorConfig(readCacheTtlSeconds),
  cloudflareGraphqlEndpoint: readConnectorConfig(readCloudflareGraphqlEndpoint),
  cloudflareZoneId: requiredStringConfig(cloudflareZoneIdEnv),
  compatibilityDate: optionalStringConfig(compatibilityDateEnv, '2026-06-22'),
  cvWebHost: requiredStringConfig(cvWebHostEnv),
  workerName: optionalStringConfig(workerNameEnv, 'cv-analytics-connector'),
}).pipe(
  Effect.map(
    ({
      analyticsFallback,
      cacheTtlSeconds,
      cloudflareGraphqlEndpoint,
      cloudflareZoneId,
      compatibilityDate,
      cvWebHost,
      workerName,
    }) =>
      ({
        $schema: '../../node_modules/wrangler/config-schema.json',
        compatibility_date: compatibilityDate,
        main: './dist/index.js',
        name: workerName,
        observability: {
          enabled: true,
        },
        preview_urls: false,
        vars: {
          ...(analyticsFallback
            ? { [analyticsFallbackEnv]: analyticsFallback }
            : {}),
          [cacheTtlSecondsEnv]: String(cacheTtlSeconds),
          [cloudflareGraphqlEndpointEnv]: cloudflareGraphqlEndpoint,
          [cloudflareZoneIdEnv]: cloudflareZoneId,
          [cvWebHostEnv]: cvWebHost,
        },
        workers_dev: true,
      }) satisfies WranglerConfig
  )
)

const writeWranglerConfig = (outputPath: string, config: WranglerConfig) =>
  Effect.all([FileSystem, Path]).pipe(
    Effect.flatMap(([fileSystem, path]) =>
      fileSystem
        .makeDirectory(path.dirname(outputPath), {
          recursive: true,
        })
        .pipe(
          Effect.andThen(
            fileSystem.writeFileString(
              outputPath,
              `${JSON.stringify(config, null, 2)}\n`
            )
          )
        )
    )
  )

const reportError = (error: unknown) =>
  Console.error(error instanceof Error ? error.message : String(error)).pipe(
    Effect.andThen(
      Effect.sync(() => {
        process.exitCode = 1
      })
    )
  )

readOutputPath.pipe(
  Effect.zip(readWranglerConfig.pipe(withProcessConfig)),
  Effect.flatMap(([outputPath, config]) =>
    writeWranglerConfig(outputPath, config)
  ),
  Effect.catch(reportError),
  Effect.catchDefect(reportError),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain
)
