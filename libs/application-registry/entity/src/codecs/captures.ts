import {
  createInsertSchema,
  createSelectSchema,
} from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import { ConfidenceSchema, UtcIsoTimestampSchema } from '../model/constraints'
import {
  ArtifactManifestEntrySchema,
  SubmissionDetailsSchema,
} from '../model/details'
import { FitAssessmentSchema } from '../model/fit-assessment'
import { campaignCaptures } from '../tables/captures'
import { optionalNullableInsertField } from './optional-nullable-insert-field'

const campaignCaptureSelectRefinements = {
  artifacts: () => Schema.Array(ArtifactManifestEntrySchema),
  confidence: () => ConfidenceSchema,
  fitAssessment: () => FitAssessmentSchema,
  submissionDetails: () => SubmissionDetailsSchema,
  capturedAt: () => UtcIsoTimestampSchema,
}

const campaignCaptureInsertRefinements = {
  artifacts: Schema.Array(ArtifactManifestEntrySchema),
  confidence: optionalNullableInsertField(ConfidenceSchema),
  fitAssessment: optionalNullableInsertField(FitAssessmentSchema),
  submissionDetails: SubmissionDetailsSchema,
  capturedAt: UtcIsoTimestampSchema,
}

export const CampaignCaptureSchema = createSelectSchema(
  campaignCaptures,
  campaignCaptureSelectRefinements
)

export type CampaignCapture = typeof campaignCaptures.$inferSelect

export const CampaignCaptureInsertSchema = createInsertSchema(
  campaignCaptures,
  campaignCaptureInsertRefinements
)
