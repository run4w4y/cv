import { Schema } from 'effect'
import type { JsonSchema } from 'effect/JsonSchema'

/** Narrow interoperability boundary between Effect Schema and structured generation. */
export const toGenerationJsonSchema = (schema: Schema.Top): JsonSchema => {
  const standard = Schema.toStandardJSONSchemaV1(schema)
  return standard['~standard'].jsonSchema.input({
    target: 'draft-07',
  })
}
