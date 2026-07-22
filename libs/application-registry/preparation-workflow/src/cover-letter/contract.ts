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

export interface CoverLetterDocument
  extends Schema.Schema.Type<typeof CoverLetterDocumentSchema> {}

/** An intentionally incomplete editor value; it is not a valid document yet. */
export const initialCoverLetterDraft = (locale: string): unknown => ({
  $schema: coverLetterContractId,
  locale,
  body: '',
})
