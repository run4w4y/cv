import { Schema } from 'effect'

export const PdfPermanentFailureCodeSchema = Schema.Literals([
  'cv_page_layout_invalid',
  'cv_page_overflow',
  'pdf_generation_invalid',
  'pdf_publication_changed',
  'pdf_public_page_unavailable',
  'pdf_retry_exhausted',
])
export type PdfPermanentFailureCode = typeof PdfPermanentFailureCodeSchema.Type

export const PdfTransientFailureCodeSchema = Schema.Literals([
  'pdf_persistence_failed',
  'pdf_render_failed',
])
export type PdfTransientFailureCode = typeof PdfTransientFailureCodeSchema.Type

export class PdfGenerationPermanentError extends Schema.TaggedErrorClass<PdfGenerationPermanentError>()(
  'PdfGenerationPermanentError',
  {
    cause: Schema.Defect(),
    code: PdfPermanentFailureCodeSchema,
    message: Schema.String,
  }
) {}

export class PdfGenerationTransientError extends Schema.TaggedErrorClass<PdfGenerationTransientError>()(
  'PdfGenerationTransientError',
  {
    cause: Schema.Defect(),
    code: PdfTransientFailureCodeSchema,
    message: Schema.String,
    retryAfterSeconds: Schema.optionalKey(Schema.Int),
  }
) {}
