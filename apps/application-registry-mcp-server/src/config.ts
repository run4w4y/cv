import { Config, Effect, type Redacted, Schema } from 'effect'

export const registryApiUrlEnv = 'REGISTRY_API_URL'
export const registryApiTokenEnv = 'REGISTRY_API_TOKEN'

const redactedNonEmptyStringSchema = Schema.RedactedFromValue(
  Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))
)

export interface ApplicationRegistryMcpConfig {
  readonly apiUrl: URL
  readonly token: Redacted.Redacted<string>
}

export class ApplicationRegistryMcpConfigError extends Schema.TaggedErrorClass<ApplicationRegistryMcpConfigError>()(
  'ApplicationRegistryMcpConfigError',
  { message: Schema.String }
) {}

export const readApplicationRegistryMcpConfig: Effect.Effect<
  ApplicationRegistryMcpConfig,
  ApplicationRegistryMcpConfigError
> = Effect.gen(function* () {
  const apiOrigin = yield* Config.url(registryApiUrlEnv)
  const token = yield* Config.schema(
    redactedNonEmptyStringSchema,
    registryApiTokenEnv
  )

  return {
    apiUrl: apiOrigin,
    token,
  }
}).pipe(
  Effect.mapError(
    () =>
      new ApplicationRegistryMcpConfigError({
        message: `Application registry MCP configuration is invalid; set ${registryApiUrlEnv} to the registry origin and ${registryApiTokenEnv} to a non-empty bearer token.`,
      })
  )
)
