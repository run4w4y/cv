import { CvDocumentV1Schema } from '@cv/contracts/document'

import { toGenerationContract } from '../generation/ai-schema'

export const cvDocumentV1GenerationContract =
  toGenerationContract(CvDocumentV1Schema)

/** @deprecated Prefer the paired generation contract inside workflow code. */
export const cvDocumentV1JsonSchema =
  cvDocumentV1GenerationContract.outputSchema
