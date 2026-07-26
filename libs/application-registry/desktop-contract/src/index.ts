import { RegistryOriginSchema } from '@cv/application-registry-api-contract'
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
  'configuration_invalid',
  'encryption_unavailable',
  'invalid_request',
  'network_failed',
  'registry_not_configured',
  'registry_unauthorized',
  'settings_corrupt',
  'settings_io_failed',
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

export const DesktopCodexThreadIdSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty()),
  Schema.check(Schema.isMaxLength(256))
)

export const DesktopDocumentCheckpointIdSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty()),
  Schema.check(Schema.isMaxLength(128))
)

export const DocumentPathSegmentSchema = Schema.Union([
  Schema.Trim.pipe(
    Schema.check(Schema.isNonEmpty()),
    Schema.check(Schema.isMaxLength(256))
  ),
  Schema.Int.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.check(Schema.isLessThanOrEqualTo(1_000_000))
  ),
])
export type DocumentPathSegment = typeof DocumentPathSegmentSchema.Type

export const DocumentPathSchema = Schema.Array(DocumentPathSegmentSchema).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(64))
)
export type DocumentPath = typeof DocumentPathSchema.Type

export const DocumentAddPatchSchema = Schema.Struct({
  op: Schema.Literal('add'),
  path: DocumentPathSchema,
  value: Schema.Json,
})
export interface DocumentAddPatch
  extends Schema.Schema.Type<typeof DocumentAddPatchSchema> {}

export const DocumentReplacePatchSchema = Schema.Struct({
  op: Schema.Literal('replace'),
  path: DocumentPathSchema,
  value: Schema.Json,
})
export interface DocumentReplacePatch
  extends Schema.Schema.Type<typeof DocumentReplacePatchSchema> {}

export const DocumentRemovePatchSchema = Schema.Struct({
  op: Schema.Literal('remove'),
  path: DocumentPathSchema,
})
export interface DocumentRemovePatch
  extends Schema.Schema.Type<typeof DocumentRemovePatchSchema> {}

/**
 * Patches are applied in array order. Tuple paths avoid JSON Pointer escaping
 * and map directly to state-tree paths.
 */
export const DocumentPatchSchema = Schema.Union([
  DocumentAddPatchSchema,
  DocumentReplacePatchSchema,
  DocumentRemovePatchSchema,
])
export type DocumentPatch = typeof DocumentPatchSchema.Type

export const DocumentAssistantResponseSchema = Schema.Struct({
  patches: Schema.Array(DocumentPatchSchema).pipe(
    Schema.check(Schema.isMaxLength(200))
  ),
  reply: Schema.Trim.pipe(
    Schema.check(Schema.isNonEmpty()),
    Schema.check(Schema.isMaxLength(20_000))
  ),
})
export interface DocumentAssistantResponse
  extends Schema.Schema.Type<typeof DocumentAssistantResponseSchema> {}

export const defaultDocumentAssistantProtectedPaths = [
  ['$schema'],
  ['locale'],
  ['direction'],
  ['person', 'name'],
  ['person', 'contacts'],
] as const satisfies ReadonlyArray<DocumentPath>

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

/**
 * Omitting `threadId` starts a conversation. Supplying it resumes that exact
 * persisted Codex thread. `checkpointId` identifies the immutable document
 * snapshot used for this turn and is echoed in the result so the renderer can
 * reject a response after its draft has moved on. `instructions` is reserved
 * for application-authored editing policy. `context` is untrusted external
 * reference data (including job postings) and must never be promoted into
 * `instructions`.
 */
export const DesktopDocumentAssistantRequestSchema = Schema.Struct({
  checkpointId: DesktopDocumentCheckpointIdSchema,
  context: Schema.optionalKey(Schema.Json),
  document: Schema.Json,
  instructions: Schema.optionalKey(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(100_000)))
  ),
  operationId: DesktopOperationIdSchema,
  prompt: Schema.Trim.pipe(
    Schema.check(Schema.isNonEmpty()),
    Schema.check(Schema.isMaxLength(100_000))
  ),
  protectedPaths: Schema.optionalKey(
    Schema.Array(DocumentPathSchema).pipe(Schema.check(Schema.isMaxLength(200)))
  ),
  threadId: Schema.optionalKey(DesktopCodexThreadIdSchema),
})
export interface DesktopDocumentAssistantRequest
  extends Schema.Schema.Type<typeof DesktopDocumentAssistantRequestSchema> {}

export const DesktopDocumentAssistantResultSchema = Schema.Struct({
  checkpointId: DesktopDocumentCheckpointIdSchema,
  operationId: DesktopOperationIdSchema,
  response: DocumentAssistantResponseSchema,
  threadId: DesktopCodexThreadIdSchema,
  usage: DesktopTokenUsageSchema,
})
export interface DesktopDocumentAssistantResult
  extends Schema.Schema.Type<typeof DesktopDocumentAssistantResultSchema> {}

export interface DesktopCodexBridge {
  readonly assist: (
    request: DesktopDocumentAssistantRequest
  ) => Promise<DesktopBridgeResult<DesktopDocumentAssistantResult>>
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
  origin: RegistryOriginSchema,
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
