import { CvDocumentV1Schema } from '@cv/contracts/document'

import { toGenerationJsonSchema } from '../generation/ai-schema'

export const cvDocumentV1JsonSchema = toGenerationJsonSchema(CvDocumentV1Schema)
