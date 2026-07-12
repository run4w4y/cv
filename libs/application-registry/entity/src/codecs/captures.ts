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
import { campaignCaptures } from '../tables/captures'
import { optionalNullable, refineWith } from './refinements'

const campaignCaptureSelectRefinements = {
  artifacts: refineWith(Schema.Array(ArtifactManifestEntrySchema)),
  confidence: refineWith(ConfidenceSchema),
  submissionDetails: refineWith(SubmissionDetailsSchema),
  capturedAt: refineWith(UtcIsoTimestampSchema),
}

const campaignCaptureInsertRefinements = {
  artifacts: Schema.Array(ArtifactManifestEntrySchema),
  confidence: optionalNullable(ConfidenceSchema),
  submissionDetails: SubmissionDetailsSchema,
  capturedAt: UtcIsoTimestampSchema,
}

export const CampaignCaptureSchema = createSelectSchema(
  campaignCaptures,
  campaignCaptureSelectRefinements
)

export const CampaignCaptureInsertSchema = createInsertSchema(
  campaignCaptures,
  campaignCaptureInsertRefinements
)

export type CampaignCapture = Schema.Schema.Type<typeof CampaignCaptureSchema>
