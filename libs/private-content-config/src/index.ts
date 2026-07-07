import { Config, ConfigProvider, Data, Effect, Option, Schema } from 'effect'

export type PrivateContentEnv = Readonly<Record<string, string | undefined>>

export const privateContentEnvNames = {
  audienceKey: 'PRIVATE_CONTENT_AUDIENCE_KEY',
  contentIdSalt: 'CONTENT_ID_SALT',
  contentRoot: 'CONTENT_ROOT',
  rootKey: 'PRIVATE_CONTENT_ROOT_KEY',
} as const

export class PrivateContentConfigError extends Data.TaggedError(
  'PrivateContentConfigError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {
  static fromConfigError(cause: Config.ConfigError) {
    return new PrivateContentConfigError({
      cause,
      message: cause.message,
    })
  }

  static missingPrivateBuildSecrets() {
    return new PrivateContentConfigError({
      message: `Private content build secrets are incomplete. Set ${privateContentEnvNames.rootKey}.`,
    })
  }
}

const defaultEnv = (): PrivateContentEnv => {
  if (typeof process === 'undefined') {
    return {}
  }

  return process.env
}

const privateContentEnvValue = (env: PrivateContentEnv, name: string) => {
  const value = env[name]?.trim()

  return value ? value : undefined
}

const privateContentConfigProviderFromEnv = (
  env: PrivateContentEnv = defaultEnv()
) =>
  ConfigProvider.fromEnv({
    env: Object.fromEntries(
      Object.entries(env).flatMap(([key, value]) => {
        const trimmed = value?.trim()

        return trimmed ? [[key, trimmed]] : []
      })
    ),
  })

export const withPrivateContentEnv = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  env: PrivateContentEnv = defaultEnv()
) =>
  effect.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      privateContentConfigProviderFromEnv(env)
    )
  )

const mapConfigError = <A>(effect: Effect.Effect<A, Config.ConfigError>) =>
  effect.pipe(Effect.mapError(PrivateContentConfigError.fromConfigError))

export const contentBuildConfigSchema = Schema.Struct({
  contentIdSalt: Schema.NonEmptyString,
  contentRoot: Schema.NonEmptyString,
})

export const privateContentBuildSecretsSchema = Schema.Struct({
  rootKey: Schema.NonEmptyString,
})

export type ContentBuildConfig = Schema.Schema.Type<
  typeof contentBuildConfigSchema
>

export type PrivateContentBuildSecrets = Schema.Schema.Type<
  typeof privateContentBuildSecretsSchema
>

const contentBuildConfigEnvSchema = Schema.Struct({
  [privateContentEnvNames.contentIdSalt]:
    contentBuildConfigSchema.fields.contentIdSalt,
  [privateContentEnvNames.contentRoot]:
    contentBuildConfigSchema.fields.contentRoot,
})

const privateBuildSecretsEnvSchema = Schema.Struct({
  [privateContentEnvNames.rootKey]: Schema.optional(
    privateContentBuildSecretsSchema.fields.rootKey
  ),
})

const readPrivateContentBuildConfig: Effect.Effect<
  ContentBuildConfig,
  PrivateContentConfigError
> = Config.schema(contentBuildConfigEnvSchema).pipe(
  Effect.map(
    (env) =>
      ({
        contentIdSalt: env[privateContentEnvNames.contentIdSalt],
        contentRoot: env[privateContentEnvNames.contentRoot],
      }) satisfies ContentBuildConfig
  ),
  mapConfigError
)

const readPrivateContentBuildSecrets: Effect.Effect<
  PrivateContentBuildSecrets | null,
  PrivateContentConfigError
> = Config.schema(privateBuildSecretsEnvSchema).pipe(
  Effect.map((env) => {
    const rootKey = env[privateContentEnvNames.rootKey]

    return rootKey
      ? ({
          rootKey,
        } satisfies PrivateContentBuildSecrets)
      : null
  }),
  mapConfigError
)

export const readRequiredPrivateContentBuildSecrets =
  readPrivateContentBuildSecrets.pipe(
    Effect.flatMap((secrets) =>
      secrets
        ? Effect.succeed(secrets)
        : Effect.fail(PrivateContentConfigError.missingPrivateBuildSecrets())
    )
  )

export const readPrivateContentIdSalt: Effect.Effect<
  string,
  PrivateContentConfigError
> = Config.nonEmptyString(privateContentEnvNames.contentIdSalt).pipe(
  mapConfigError
)

export const readPrivateAudienceKey: Effect.Effect<
  string,
  PrivateContentConfigError
> = Config.nonEmptyString(privateContentEnvNames.audienceKey).pipe(
  mapConfigError
)

export const readOptionalPrivateAudienceKey: Effect.Effect<
  string | undefined,
  PrivateContentConfigError
> = Config.nonEmptyString(privateContentEnvNames.audienceKey).pipe(
  Config.option,
  Effect.map(Option.getOrUndefined),
  mapConfigError
)

export const readPrivateContentBuildConfigFromEnv = (
  env: PrivateContentEnv = defaultEnv()
) => Effect.runSync(withPrivateContentEnv(readPrivateContentBuildConfig, env))

export const readPrivateContentBuildSecretsFromEnv = (
  env: PrivateContentEnv = defaultEnv()
) => Effect.runSync(withPrivateContentEnv(readPrivateContentBuildSecrets, env))

export const readRequiredPrivateContentBuildSecretsFromEnv = (
  env: PrivateContentEnv = defaultEnv()
) =>
  Effect.runSync(
    withPrivateContentEnv(readRequiredPrivateContentBuildSecrets, env)
  )

export const readPrivateContentIdSaltFromEnv = (
  env: PrivateContentEnv = defaultEnv()
) => Effect.runSync(withPrivateContentEnv(readPrivateContentIdSalt, env))

export const readPrivateAudienceKeyFromEnv = (
  env: PrivateContentEnv = defaultEnv()
) => Effect.runSync(withPrivateContentEnv(readPrivateAudienceKey, env))

export const missingPrivateContentAccessEnv = (
  env: PrivateContentEnv = defaultEnv()
) =>
  [
    privateContentEnvNames.contentIdSalt,
    privateContentEnvNames.audienceKey,
    privateContentEnvNames.rootKey,
  ].filter((name) => !privateContentEnvValue(env, name))
