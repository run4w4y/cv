import { Schema } from 'effect'

const NullableText = Schema.NullOr(Schema.String)

/** Application-submission metadata retained on immutable campaign captures. */
export const SubmissionDetailsSchema = Schema.Struct({
  applicationMethod: NullableText,
  contactEmail: NullableText,
  deadline: NullableText,
  employmentType: NullableText,
  workMode: NullableText,
  locationRestrictions: NullableText,
  salary: NullableText,
  visaRequirements: NullableText,
  relocation: NullableText,
  languageRequirements: Schema.Array(Schema.String),
  requiredDocuments: Schema.Array(Schema.String),
  applicationQuestions: Schema.Array(Schema.String),
  coverLetterInstructions: NullableText,
  additionalInstructions: NullableText,
})

export type SubmissionDetails = Schema.Schema.Type<
  typeof SubmissionDetailsSchema
>

export const ArtifactManifestEntrySchema = Schema.Struct({
  kind: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  mediaType: Schema.NullOr(Schema.NonEmptyString),
  sha256: Schema.NullOr(Schema.NonEmptyString),
})

export type ArtifactManifestEntry = Schema.Schema.Type<
  typeof ArtifactManifestEntrySchema
>
