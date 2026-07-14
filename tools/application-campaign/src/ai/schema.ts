import { Schema } from 'effect'

const stringArraySchema = Schema.Array(Schema.String)

export const campaignJobSchema = Schema.Struct({
  applicationQuestions: stringArraySchema,
  company: Schema.String,
  concerns: stringArraySchema,
  coverLetterInstructions: stringArraySchema,
  coverLetterRequired: Schema.Boolean,
  differentiators: stringArraySchema,
  hiringSignals: stringArraySchema,
  location: Schema.String,
  niceToHaveSignals: stringArraySchema,
  routineSignals: stringArraySchema,
  requiredSignals: stringArraySchema,
  role: Schema.String,
  seniority: Schema.String,
  summary: Schema.String,
  technologies: stringArraySchema,
  workMode: Schema.String,
})

export const campaignAlternativeSchema = Schema.Struct({
  profile: Schema.String,
  rationale: Schema.String,
})

export const campaignProfileShortlistItemSchema = Schema.Struct({
  evidenceNeeded: stringArraySchema,
  profile: Schema.String,
  rationale: Schema.String,
})

export const campaignMatchedEvidenceSchema = Schema.Struct({
  evidence: stringArraySchema,
  signal: Schema.String,
})

export const campaignRecommendationDecisionSchema = Schema.Struct({
  alternatives: Schema.Array(campaignAlternativeSchema),
  audienceSlug: Schema.String,
  confidence: Schema.Number,
  profile: Schema.String,
  rationale: Schema.String,
})

export const campaignMessageSchema = Schema.Struct({
  body: Schema.String,
  subject: Schema.String,
})

export const CampaignRecommendationSchema = Schema.Struct({
  coverLetter: campaignMessageSchema,
  email: campaignMessageSchema,
  followUpQuestions: stringArraySchema,
  job: campaignJobSchema,
  matchedEvidence: Schema.Array(campaignMatchedEvidenceSchema),
  recommendation: campaignRecommendationDecisionSchema,
})

export type CampaignRecommendation = Schema.Schema.Type<
  typeof CampaignRecommendationSchema
>

export type CampaignRecommendationResult = {
  readonly extensions: Readonly<Record<string, unknown>>
  readonly recommendation: CampaignRecommendation
}

export const makeCampaignRecommendationResultSchema = <
  Fields extends Schema.Struct.Fields,
>(
  extensionFields: Fields
) =>
  Schema.Struct({
    ...CampaignRecommendationSchema.fields,
    extensions: Schema.Struct(extensionFields),
  })

export const CampaignProfileShortlistSchema = Schema.Struct({
  job: campaignJobSchema,
  profileShortlist: Schema.Array(campaignProfileShortlistItemSchema),
})

export type CampaignProfileShortlist = Schema.Schema.Type<
  typeof CampaignProfileShortlistSchema
>

export type CampaignJobAnalysis = CampaignProfileShortlist & {
  readonly extensions: Readonly<Record<string, unknown>>
}

export const makeCampaignJobAnalysisSchema = <
  Fields extends Schema.Struct.Fields,
>(
  extensionFields: Fields
) =>
  Schema.Struct({
    ...CampaignProfileShortlistSchema.fields,
    extensions: Schema.Struct(extensionFields),
  })
