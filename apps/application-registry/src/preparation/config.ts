import { cloudflareR2Endpoint, type FactsR2Options } from '@cv/facts-r2'
import { Config, ConfigProvider, Effect, Redacted, Schema } from 'effect'

export const publicCvBaseUrlEnv = 'VITE_CV_PUBLIC_BASE_URL'
export const factsR2AccountIdEnv = 'VITE_FACTS_R2_ACCOUNT_ID'
export const factsR2BucketEnv = 'VITE_FACTS_R2_BUCKET'
export const factsR2AccessKeyIdEnv = 'VITE_FACTS_R2_ACCESS_KEY_ID'
export const factsR2SecretAccessKeyEnv = 'VITE_FACTS_R2_SECRET_ACCESS_KEY'

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
  publicCvBaseUrlFromEnvironment(import.meta.env, window.location.origin)

const factsR2AccountIdSchema = Schema.Trim.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{32}$/u))
)
const factsR2BucketSchema = Schema.Trim.pipe(
  Schema.check(Schema.isPattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u))
)
const factsR2CredentialSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty())
)

const readFactsR2Options = Effect.gen(function* () {
  const accountId = yield* Config.schema(
    factsR2AccountIdSchema,
    factsR2AccountIdEnv
  )
  return {
    accessKeyId: Redacted.make(
      yield* Config.schema(factsR2CredentialSchema, factsR2AccessKeyIdEnv)
    ),
    bucket: yield* Config.schema(factsR2BucketSchema, factsR2BucketEnv),
    endpoint: cloudflareR2Endpoint(accountId),
    secretAccessKey: Redacted.make(
      yield* Config.schema(factsR2CredentialSchema, factsR2SecretAccessKeyEnv)
    ),
  } satisfies FactsR2Options
})

export const factsR2OptionsFromEnvironment = (
  environment: Readonly<Record<string, string | undefined>>
): FactsR2Options =>
  Effect.runSync(
    readFactsR2Options.pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromEnv({
            env: Object.fromEntries(
              Object.entries(environment).filter(
                (entry): entry is [string, string] => entry[1] !== undefined
              )
            ),
          })
        )
      )
    )
  )

export const factsR2Options = (): FactsR2Options =>
  factsR2OptionsFromEnvironment(import.meta.env)
