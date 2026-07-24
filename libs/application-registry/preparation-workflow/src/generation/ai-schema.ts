import type { Schema } from 'effect'
import type { JsonSchema } from 'effect/JsonSchema'
import { OpenAiStructuredOutput } from 'effect/unstable/ai'

/**
 * Keeps the provider-safe JSON Schema and its matching response codec together.
 *
 * Effect may change the wire representation to satisfy OpenAI Structured
 * Outputs, so callers must decode with this codec instead of the source schema.
 */
export type GenerationContract<Output> = {
  readonly codec: Schema.ConstraintCodec<Output, unknown, never, never>
  readonly outputSchema: JsonSchema
}

/** Narrow interoperability boundary between Effect Schema and OpenAI. */
export const toGenerationContract = <Output, Encoded>(
  schema: Schema.ConstraintCodec<Output, Encoded, never, never>
): GenerationContract<Output> => {
  const { codec, jsonSchema } = OpenAiStructuredOutput.toCodecOpenAI(schema)
  return { codec, outputSchema: jsonSchema }
}
