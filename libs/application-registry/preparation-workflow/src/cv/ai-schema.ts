import {
  collectGenerationGuidance,
  CvDocumentV1Schema,
  cvDocumentV1GenerationGuidance,
} from '@cv/contracts/document'
import { Schema } from 'effect'

import { toAiJsonSchema } from '../generation/ai-schema'

const annotatedDocument = Schema.toJsonSchemaDocument(CvDocumentV1Schema, {
  includeAnnotationKey: (key) => key === 'generationGuidance',
})

export const cvDocumentV1AnnotatedJsonSchema: Record<string, unknown> = {
  ...annotatedDocument.schema,
  ...(Object.keys(annotatedDocument.definitions).length === 0
    ? {}
    : { $defs: annotatedDocument.definitions }),
}

export const cvDocumentV1GuidanceItems =
  collectGenerationGuidance(CvDocumentV1Schema)

export const cvDocumentV1JsonSchema = toAiJsonSchema(CvDocumentV1Schema)

export const cvDocumentV1ModelGuidance = {
  instruction: cvDocumentV1GenerationGuidance.instruction,
  rules: cvDocumentV1GenerationGuidance.rules,
  fields: cvDocumentV1GuidanceItems,
}
