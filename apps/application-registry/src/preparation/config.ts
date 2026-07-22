import { Config, ConfigProvider, Effect, Schema } from 'effect'

export const publicCvBaseUrlEnv = 'VITE_CV_PUBLIC_BASE_URL'

const publicCvBaseUrlSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty())
)

const readPublicCvBaseUrl = (fallback: string) =>
  Config.schema(publicCvBaseUrlSchema, publicCvBaseUrlEnv).pipe(
    Config.withDefault(fallback),
    Config.map((value) => value.replace(/\/+$/u, ''))
  )

export const publicCvBaseUrlFromEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
  origin: string
): string => {
  const configured = environment[publicCvBaseUrlEnv]?.trim()
  const provider = ConfigProvider.fromEnv({
    env:
      configured === undefined || configured.length === 0
        ? {}
        : { [publicCvBaseUrlEnv]: configured },
  })

  return Effect.runSync(
    readPublicCvBaseUrl(`${origin}/c`).pipe(
      Effect.provide(ConfigProvider.layer(provider))
    )
  )
}

/** Resolves the browser publication base once at the UI boundary. */
export const publicCvBaseUrl = (): string =>
  publicCvBaseUrlFromEnvironment(
    { [publicCvBaseUrlEnv]: import.meta.env.VITE_CV_PUBLIC_BASE_URL },
    window.location.origin
  )
