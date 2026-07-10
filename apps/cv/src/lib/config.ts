import { Config, ConfigProvider, Data, Effect, Option } from 'effect'

const cvWebBaseUrlEnv = 'CV_WEB_BASE_URL'
const publicCvWebBaseUrlEnv = 'PUBLIC_CV_WEB_BASE_URL'
export const fallbackWebCvBaseUrl = 'https://run4w4y.github.io/cv/'

export type EnvRecord = Readonly<Record<string, string | undefined>>

export type CvWebConfig = {
  readonly webBaseUrl: string
}

export class CvConfigError extends Data.TaggedError('CvConfigError')<{
  readonly cause: Config.ConfigError
}> {
  override get message() {
    return this.cause.message
  }

  static fromConfigError(cause: Config.ConfigError) {
    return new CvConfigError({ cause })
  }
}

const defaultEnv = (): EnvRecord => process.env

const configProviderFromEnv = (env: EnvRecord = defaultEnv()) =>
  ConfigProvider.fromEnv({
    env: Object.fromEntries(
      Object.entries(env).flatMap(([key, value]) => {
        const trimmed = value?.trim()

        return trimmed ? [[key, trimmed]] : []
      })
    ),
  })

const withConfigEnv = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  env: EnvRecord = defaultEnv()
) =>
  effect.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      configProviderFromEnv(env)
    )
  )

const optionalWebBaseUrlConfig = (name: string) =>
  Config.url(name).pipe(
    Config.option,
    Effect.map(Option.getOrUndefined),
    Effect.map((url) => url?.href),
    Effect.mapError(CvConfigError.fromConfigError)
  )

export const readCvWebConfig: Effect.Effect<CvWebConfig, CvConfigError> =
  Effect.gen(function* () {
    const configuredUrl = yield* optionalWebBaseUrlConfig(cvWebBaseUrlEnv)
    const publicUrl = yield* optionalWebBaseUrlConfig(publicCvWebBaseUrlEnv)
    return {
      webBaseUrl: configuredUrl ?? publicUrl ?? fallbackWebCvBaseUrl,
    }
  })

export const readCvWebConfigFromEnv = (env: EnvRecord = defaultEnv()) =>
  withConfigEnv(readCvWebConfig, env)

export const getCvWebConfig = (env?: EnvRecord) =>
  Effect.runSync(readCvWebConfigFromEnv(env))
