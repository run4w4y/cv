import { toGenerationContract } from '../generation/ai-schema'

import { CoverLetterDocumentSchema } from './contract'

export const coverLetterGenerationContract = toGenerationContract(
  CoverLetterDocumentSchema
)

/** @deprecated Prefer the paired generation contract inside workflow code. */
export const coverLetterJsonSchema = coverLetterGenerationContract.outputSchema
