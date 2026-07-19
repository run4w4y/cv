import {
  ArtifactStatusSchema,
  ExpectedApplicationVersionSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

export const StartPdfJobRequestSchema = Schema.Struct({
  expectedPublicationVersion: ExpectedApplicationVersionSchema,
  rendererVersion: NonEmptyString,
  requestId: NonEmptyString,
})
export interface StartPdfJobRequest
  extends Schema.Schema.Type<typeof StartPdfJobRequestSchema> {}

export const PdfJobParamsSchema = Schema.Struct({
  entryId: NonEmptyString,
  id: NonEmptyString,
  jobId: NonEmptyString,
})

export const PdfJobResponseSchema = Schema.Struct({
  errorCode: Schema.NullOr(NonEmptyString),
  errorMessage: Schema.NullOr(NonEmptyString),
  jobId: NonEmptyString,
  status: ArtifactStatusSchema,
})
export interface PdfJobResponse
  extends Schema.Schema.Type<typeof PdfJobResponseSchema> {}

export const PdfGenerationRequestedSchema = Schema.TaggedStruct(
  'PdfGenerationRequested',
  {
    applicationId: NonEmptyString,
    artifactId: NonEmptyString,
    entryId: NonEmptyString,
    version: Schema.Literal(1),
  }
)
export interface PdfGenerationRequested
  extends Schema.Schema.Type<typeof PdfGenerationRequestedSchema> {}
