import { resolve } from 'node:path'
import type { Redacted } from 'effect'
import { Config, Effect, Option, Schema } from 'effect'
import { ApplicationRegistryConfigError } from './errors'

export const registryApiUrlEnv = 'REGISTRY_API_URL'
export const registryApiTokenEnv = 'REGISTRY_API_TOKEN'
export const registryDeviceIdEnv = 'REGISTRY_DEVICE_ID'
export const registryOutboxDirEnv = 'REGISTRY_OUTBOX_DIR'

const defaultRepositoryRoot = resolve(import.meta.dir, '../../..')
export const defaultRegistryOutboxDirectory = resolve(
  defaultRepositoryRoot,
  '.cv-work/application-registry/outbox'
)

const redactedNonEmptyStringSchema = Schema.RedactedFromValue(
  Schema.NonEmptyString
)

export type ApplicationRegistryClientConfig = {
  readonly apiUrl: URL
  readonly deviceId: string | null
  readonly outboxDirectory: string
  readonly token: Redacted.Redacted<string>
}

const readOptionalConfig = Effect.gen(function* () {
  const apiUrl = yield* Config.url(registryApiUrlEnv).pipe(Config.option)
  const token = yield* Config.schema(
    redactedNonEmptyStringSchema,
    registryApiTokenEnv
  ).pipe(Config.option)

  if (Option.isNone(apiUrl) && Option.isNone(token)) {
    return Option.none<ApplicationRegistryClientConfig>()
  }
  if (Option.isNone(apiUrl) || Option.isNone(token)) {
    const missing = [
      ...(Option.isNone(apiUrl) ? [registryApiUrlEnv] : []),
      ...(Option.isNone(token) ? [registryApiTokenEnv] : []),
    ]
    return yield* new ApplicationRegistryConfigError({
      message: `Application registry configuration is partial; missing ${missing.join(', ')}`,
    })
  }

  const deviceId = yield* Config.nonEmptyString(registryDeviceIdEnv).pipe(
    Config.option
  )
  const outboxDirectory = yield* Config.nonEmptyString(
    registryOutboxDirEnv
  ).pipe(Config.withDefault(defaultRegistryOutboxDirectory))

  return Option.some({
    apiUrl: apiUrl.value,
    deviceId: Option.getOrNull(deviceId),
    outboxDirectory,
    token: token.value,
  })
}).pipe(
  Effect.mapError(
    (cause) =>
      new ApplicationRegistryConfigError({
        cause,
        message: `Could not read application registry configuration: ${cause.message}`,
      })
  )
)

export const readOptionalApplicationRegistryClientConfig: Effect.Effect<
  Option.Option<ApplicationRegistryClientConfig>,
  ApplicationRegistryConfigError
> = readOptionalConfig

export const readApplicationRegistryClientConfig: Effect.Effect<
  ApplicationRegistryClientConfig,
  ApplicationRegistryConfigError
> = readOptionalApplicationRegistryClientConfig.pipe(
  Effect.flatMap(
    Option.match({
      onNone: () =>
        Effect.fail(
          new ApplicationRegistryConfigError({
            message: `Application registry is not configured; set ${registryApiUrlEnv} and ${registryApiTokenEnv}`,
          })
        ),
      onSome: Effect.succeed,
    })
  )
)
