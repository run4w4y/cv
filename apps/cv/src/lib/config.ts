import { Config, ConfigProvider, Data, Effect, Option } from 'effect'

export const cvWebBaseUrlEnv = 'CV_WEB_BASE_URL'
export const publicCvWebBaseUrlEnv = 'PUBLIC_CV_WEB_BASE_URL'
export const fallbackWebCvBaseUrl = 'https://run4w4y.github.io/cv'

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

const defaultEnv = (): Readonly<Record<string, string | undefined>> => {
  if (typeof process === 'undefined') {
    return {}
  }

  return process.env
}

const configProviderFromRecord = (
  env: Readonly<Record<string, string | undefined>>
) =>
  ConfigProvider.fromEnv({
    env: Object.fromEntries(
      Object.entries(env).flatMap(([key, value]) => {
        const trimmed = value?.trim()

        return trimmed ? [[key, trimmed]] : []
      })
    ),
  })

const optionalUrlConfig = (name: string) =>
  Config.url(name).pipe(
    Config.option,
    Effect.map(Option.getOrUndefined),
    Effect.mapError(CvConfigError.fromConfigError)
  )

const normalizeBaseUrl = (url: URL) => `${url.toString().replace(/\/+$/u, '')}/`

export const readCvWebConfig: Effect.Effect<CvWebConfig, CvConfigError> =
  Effect.gen(function* () {
    const configuredUrl = yield* optionalUrlConfig(cvWebBaseUrlEnv)
    const publicUrl = yield* optionalUrlConfig(publicCvWebBaseUrlEnv)

    return {
      webBaseUrl: normalizeBaseUrl(
        configuredUrl ?? publicUrl ?? new URL(fallbackWebCvBaseUrl)
      ),
    }
  })

export const readCvWebConfigFromEnv = (
  env: Readonly<Record<string, string | undefined>> = defaultEnv()
) =>
  readCvWebConfig.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      configProviderFromRecord(env)
    )
  )

export const getCvWebConfig = (
  env?: Readonly<Record<string, string | undefined>>
) => Effect.runSync(readCvWebConfigFromEnv(env))
