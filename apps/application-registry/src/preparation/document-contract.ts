import type { AiJsonSchema } from '@cv/ai-provider'
import {
  CvDocumentV1Schema,
  cvDocumentV1GenerationGuidance,
} from '@cv/contracts/document'
import { appendJsonPointer } from '@cv/schema-editor/core'
import { Schema } from 'effect'

export type SchemaGuidanceItem = {
  readonly instruction: string
  readonly maxWords: number | null
  readonly pointer: string
  readonly sources: ReadonlyArray<string>
  readonly title: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringArray = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const guidanceAt = (
  value: Record<string, unknown>,
  pointer: string
): SchemaGuidanceItem | null => {
  const guidance = value.generationGuidance
  if (!isRecord(guidance) || typeof guidance.instruction !== 'string') {
    return null
  }

  return {
    instruction: guidance.instruction,
    maxWords: typeof guidance.maxWords === 'number' ? guidance.maxWords : null,
    pointer,
    sources: stringArray(guidance.sources),
    title: typeof value.title === 'string' ? value.title : null,
  }
}

export const collectSchemaGuidance = (
  value: unknown,
  pointer = ''
): ReadonlyArray<SchemaGuidanceItem> => {
  if (!isRecord(value)) return []

  const current = guidanceAt(value, pointer)
  const properties = isRecord(value.properties)
    ? Object.entries(value.properties).flatMap(([key, child]) =>
        collectSchemaGuidance(child, appendJsonPointer(pointer, key))
      )
    : []
  const definitions = isRecord(value.$defs)
    ? Object.entries(value.$defs).flatMap(([key, child]) =>
        collectSchemaGuidance(child, appendJsonPointer('/$defs', key))
      )
    : []
  const items = value.items
    ? collectSchemaGuidance(value.items, appendJsonPointer(pointer, 0))
    : []
  const variants = ['allOf', 'anyOf', 'oneOf'].flatMap((keyword) => {
    const children = value[keyword]
    return Array.isArray(children)
      ? children.flatMap((child, index) =>
          collectSchemaGuidance(
            child,
            appendJsonPointer(appendJsonPointer(pointer, keyword), index)
          )
        )
      : []
  })

  return [
    ...(current === null ? [] : [current]),
    ...properties,
    ...definitions,
    ...items,
    ...variants,
  ]
}

const annotatedDocument = Schema.toJsonSchemaDocument(CvDocumentV1Schema, {
  includeAnnotationKey: (key) => key === 'generationGuidance',
})

export const cvDocumentV1AnnotatedJsonSchema: Record<string, unknown> = {
  ...annotatedDocument.schema,
  ...(Object.keys(annotatedDocument.definitions).length === 0
    ? {}
    : { $defs: annotatedDocument.definitions }),
}

export const cvDocumentV1GuidanceItems = collectSchemaGuidance(
  cvDocumentV1AnnotatedJsonSchema
)

const standardDocument = Schema.toStandardJSONSchemaV1(CvDocumentV1Schema)
const draftSevenDocument = standardDocument['~standard'].jsonSchema.input({
  target: 'draft-07',
})

// The AI SDK still types its JSON Schema input as Draft 7, while Standard JSON
// Schema intentionally returns `Record<string, unknown>`. This assertion is the
// narrow interoperability boundary; the same schema is validated again by the
// Effect contract and the AI provider's AJV validator.
export const cvDocumentV1JsonSchema = draftSevenDocument as AiJsonSchema

export const cvDocumentV1ModelGuidance = {
  instruction: cvDocumentV1GenerationGuidance.instruction,
  rules: cvDocumentV1GenerationGuidance.rules,
  fields: cvDocumentV1GuidanceItems,
}
