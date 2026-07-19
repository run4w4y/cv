import type { AiJsonSchema } from '@cv/ai-provider'
import { Schema } from 'effect'

/** Narrow interoperability boundary between Effect Schema and the AI SDK. */
export const toAiJsonSchema = (schema: Schema.Top): AiJsonSchema => {
  const standard = Schema.toStandardJSONSchemaV1(schema)
  return standard['~standard'].jsonSchema.input({
    target: 'draft-07',
  }) as AiJsonSchema
}
