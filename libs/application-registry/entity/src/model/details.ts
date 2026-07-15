import { Schema } from 'effect'

const NullableText = Schema.NullOr(Schema.String)

export const CountryCodeSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Z]{2}$/u))
)

export type CountryCode = Schema.Schema.Type<typeof CountryCodeSchema>

/**
 * Orthogonal opportunity attributes shared by every geography and work mode.
 *
 * Text is intentionally retained for requirements whose source semantics are
 * not boolean (for example, "Yes, verify" or "EU/UK only"). Structured money
 * is stored separately in application_compensations.
 */
export const OpportunityDetailsSchema = Schema.Struct({
  countryCode: Schema.NullOr(CountryCodeSchema),
  region: NullableText,
  workMode: NullableText,
  remoteRegion: NullableText,
  timezoneOverlap: NullableText,
  employmentType: NullableText,
  languageRequirements: Schema.Array(Schema.String),
  workAuthorization: NullableText,
  residenceRequirement: NullableText,
  applyFromAbroad: NullableText,
  visaSponsorship: NullableText,
  relocationSupport: NullableText,
})

export type OpportunityDetails = Schema.Schema.Type<
  typeof OpportunityDetailsSchema
>

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
