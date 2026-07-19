import type { AiJsonSchema } from '@cv/ai-provider'
import { CvLocaleSchema } from '@cv/contracts/facts'
import { Schema } from 'effect'

export const coverLetterContractId = 'cover-letter.v1' as const
export const coverLetterContractVersion = '1' as const

export const CoverLetterDocumentSchema = Schema.Struct({
  $schema: Schema.Literal(coverLetterContractId).annotate({
    title: 'Contract ID',
  }),
  locale: CvLocaleSchema.annotate({
    title: 'Locale',
    description: 'The single locale used by the complete letter.',
  }),
  body: Schema.NonEmptyString.pipe(
    Schema.check(Schema.isMaxLength(12_000))
  ).annotate({
    title: 'Letter',
    description: 'The complete tailored cover letter, without invented facts.',
  }),
})

export type CoverLetterDocument = Schema.Schema.Type<
  typeof CoverLetterDocumentSchema
>

const standardCoverLetter = Schema.toStandardJSONSchemaV1(
  CoverLetterDocumentSchema
)

// See the equivalent boundary in document-contract.ts.
export const coverLetterJsonSchema = standardCoverLetter[
  '~standard'
].jsonSchema.input({ target: 'draft-07' }) as AiJsonSchema

export const initialCoverLetterDocument = (
  locale: string
): CoverLetterDocument => ({
  $schema: coverLetterContractId,
  locale,
  body: '',
})
