import { toGenerationJsonSchema } from '../generation/ai-schema'

import { CoverLetterDocumentSchema } from './contract'

export const coverLetterJsonSchema = toGenerationJsonSchema(
  CoverLetterDocumentSchema
)
