import { Schema } from 'effect'
import type { JsonSchema } from 'effect/JsonSchema'

export const DesktopBridgeErrorCodeSchema = Schema.Literals([
  'codex_cancelled',
  'codex_generation_failed',
  'codex_model_unavailable',
  'codex_not_authenticated',
  'codex_not_available',
  'codex_output_invalid',
  'codex_rate_limited',
  'codex_startup_failed',
  'codex_state_initialization_failed',
  'invalid_request',
  'network_failed',
  'registry_not_configured',
  'registry_unauthorized',
])
export type DesktopBridgeErrorCode = typeof DesktopBridgeErrorCodeSchema.Type

export const DesktopBridgeErrorSchema = Schema.Struct({
  code: DesktopBridgeErrorCodeSchema,
  details: Schema.optionalKey(Schema.NullOr(Schema.String)),
  message: Schema.String,
  retryAfterSeconds: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  status: Schema.optionalKey(Schema.NullOr(Schema.Number)),
})
export interface DesktopBridgeError
  extends Schema.Schema.Type<typeof DesktopBridgeErrorSchema> {}

export type DesktopBridgeResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly error: DesktopBridgeError; readonly ok: false }

const DesktopJsonSchema = Schema.declare<JsonSchema>(
  (value): value is JsonSchema =>
    value !== null && typeof value === 'object' && !Array.isArray(value),
  { identifier: 'DesktopJsonSchema' }
)

export const DesktopOperationIdSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty()),
  Schema.check(Schema.isMaxLength(128))
)

export const DesktopCodexGenerationRequestSchema = Schema.Struct({
  instructions: Schema.optionalKey(Schema.String),
  operationId: DesktopOperationIdSchema,
  outputSchema: DesktopJsonSchema,
  prompt: Schema.String.pipe(Schema.check(Schema.isMaxLength(2_000_000))),
})
export interface DesktopCodexGenerationRequest
  extends Schema.Schema.Type<typeof DesktopCodexGenerationRequestSchema> {}

export const DesktopTokenUsageSchema = Schema.Struct({
  inputTokens: Schema.NullOr(Schema.Number),
  outputTokens: Schema.NullOr(Schema.Number),
  totalTokens: Schema.NullOr(Schema.Number),
})
export interface DesktopTokenUsage
  extends Schema.Schema.Type<typeof DesktopTokenUsageSchema> {}

export type DesktopCodexGenerationResult = {
  readonly output: unknown
  readonly usage: DesktopTokenUsage
}

export interface DesktopCodexBridge {
  readonly cancel: (operationId: string) => Promise<DesktopBridgeResult<void>>
  readonly generate: (
    request: DesktopCodexGenerationRequest
  ) => Promise<DesktopBridgeResult<DesktopCodexGenerationResult>>
  readonly status: () => Promise<DesktopBridgeResult<DesktopCodexStatus>>
}

export type DesktopFetchRequest = {
  readonly body: Uint8Array | null
  readonly headers: ReadonlyArray<readonly [string, string]>
  readonly method: string
  readonly url: string
}

export type DesktopFetchResponse = {
  readonly body: Uint8Array
  readonly headers: ReadonlyArray<readonly [string, string]>
  readonly status: number
  readonly statusText: string
}

export const DesktopFetchRequestSchema = Schema.Struct({
  body: Schema.NullOr(Schema.Uint8Array),
  headers: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  method: Schema.Trim.pipe(Schema.check(Schema.isNonEmpty())),
  url: Schema.Trim.pipe(Schema.check(Schema.isNonEmpty())),
})

export type DesktopRegistryConfiguration = {
  readonly configured: boolean
  readonly editable: boolean
  readonly origin: string | null
  readonly source: 'environment' | 'stored' | 'unconfigured'
}

export const DesktopRegistryConfigureSchema = Schema.Struct({
  origin: Schema.Trim.pipe(Schema.check(Schema.isNonEmpty())),
  token: Schema.optionalKey(Schema.Trim),
})
export type DesktopRegistryConfigureInput =
  typeof DesktopRegistryConfigureSchema.Type

export type DesktopCodexStatus = {
  readonly available: boolean
  readonly executable: string | null
  readonly message: string
}

export interface DesktopHostBridge {
  readonly codex: DesktopCodexBridge
  readonly network: {
    readonly fetch: (
      request: DesktopFetchRequest
    ) => Promise<DesktopBridgeResult<DesktopFetchResponse>>
  }
  readonly registry: {
    readonly configure: (
      input: DesktopRegistryConfigureInput
    ) => Promise<DesktopBridgeResult<DesktopRegistryConfiguration>>
    readonly status: () => Promise<
      DesktopBridgeResult<DesktopRegistryConfiguration>
    >
  }
}
