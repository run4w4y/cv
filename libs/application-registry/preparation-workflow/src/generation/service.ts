import { Context, type Effect, Schema } from 'effect'
import type { JsonSchema } from 'effect/JsonSchema'

export type StructuredGenerationRequest = {
  readonly instructions?: string
  readonly outputSchema: JsonSchema
  readonly prompt: string
}

export type StructuredGenerationUsage = {
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly totalTokens: number | null
}

export type StructuredGenerationResult = {
  readonly executor: string
  readonly output: unknown
  readonly usage: StructuredGenerationUsage
}

export const StructuredGenerationErrorKindSchema = Schema.Literals([
  'authentication',
  'cancelled',
  'failed',
  'invalid-output',
  'invalid-request',
  'rate-limited',
  'unavailable',
])
export type StructuredGenerationErrorKind =
  typeof StructuredGenerationErrorKindSchema.Type

export class StructuredGenerationError extends Schema.TaggedErrorClass<StructuredGenerationError>()(
  'StructuredGenerationError',
  {
    cause: Schema.Defect(),
    kind: StructuredGenerationErrorKindSchema,
    message: Schema.String,
    retryAfterSeconds: Schema.NullOr(Schema.Number),
  }
) {}

export type StructuredGenerationShape = {
  readonly generate: (
    request: StructuredGenerationRequest
  ) => Effect.Effect<StructuredGenerationResult, StructuredGenerationError>
}

export class StructuredGeneration extends Context.Service<
  StructuredGeneration,
  StructuredGenerationShape
>()('@cv/application-preparation-workflow/StructuredGeneration') {}
