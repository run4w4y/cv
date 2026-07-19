import { createSelectSchema } from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import {
  ArtifactKindSchema,
  ArtifactStatusSchema,
  ContentEntryKindSchema,
  ContentEntryStateSchema,
  ContentRevisionSourceSchema,
  JobSnapshotStatusSchema,
} from '../model/content'
import { generatedArtifacts } from '../tables/artifacts'
import { contentEntries, contentRevisions } from '../tables/content'
import { cvLinks } from '../tables/cv-links'
import {
  factsChannels,
  factsReleaseAssets,
  factsReleaseCatalogs,
  factsReleases,
} from '../tables/facts-releases'
import { jobPostingSnapshots } from '../tables/job-posting-snapshots'
import { pdfGenerationOutbox } from '../tables/pdf-generation-outbox'

const NonNegativeIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)
const PositiveIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(1))
)

export const JobPostingSnapshotSchema = createSelectSchema(
  jobPostingSnapshots,
  {
    fetchedAt: () => UtcIsoTimestampSchema,
    normalizedByteLength: () => NonNegativeIntegerSchema,
    rawByteLength: () => NonNegativeIntegerSchema,
    status: () => JobSnapshotStatusSchema,
  }
)
export type JobPostingSnapshot = typeof jobPostingSnapshots.$inferSelect

export const FactsReleaseSchema = createSelectSchema(factsReleases, {
  createdAt: () => UtcIsoTimestampSchema,
  manifestByteLength: () => NonNegativeIntegerSchema,
})
export type FactsRelease = typeof factsReleases.$inferSelect

export const FactsReleaseCatalogSchema = createSelectSchema(
  factsReleaseCatalogs,
  { byteLength: () => NonNegativeIntegerSchema }
)
export type FactsReleaseCatalog = typeof factsReleaseCatalogs.$inferSelect

export const FactsReleaseAssetSchema = createSelectSchema(factsReleaseAssets, {
  byteLength: () => NonNegativeIntegerSchema,
})
export type FactsReleaseAsset = typeof factsReleaseAssets.$inferSelect

export const FactsChannelSchema = createSelectSchema(factsChannels, {
  updatedAt: () => UtcIsoTimestampSchema,
  version: () => PositiveIntegerSchema,
})
export type FactsChannel = typeof factsChannels.$inferSelect

export const ContentEntrySchema = createSelectSchema(contentEntries, {
  createdAt: () => UtcIsoTimestampSchema,
  kind: () => ContentEntryKindSchema,
  state: () => ContentEntryStateSchema,
  updatedAt: () => UtcIsoTimestampSchema,
  version: () => PositiveIntegerSchema,
})
export type ContentEntry = typeof contentEntries.$inferSelect

export const ContentRevisionSchema = createSelectSchema(contentRevisions, {
  byteLength: () => NonNegativeIntegerSchema,
  createdAt: () => UtcIsoTimestampSchema,
  revisionNumber: () => PositiveIntegerSchema,
  source: () => ContentRevisionSourceSchema,
})
export type ContentRevision = typeof contentRevisions.$inferSelect

export const CvLinkSchema = createSelectSchema(cvLinks, {
  createdAt: () => UtcIsoTimestampSchema,
  disabledAt: () => UtcIsoTimestampSchema,
  publicationVersion: () => PositiveIntegerSchema,
  updatedAt: () => UtcIsoTimestampSchema,
  version: () => PositiveIntegerSchema,
})
export type CvLink = typeof cvLinks.$inferSelect

export const GeneratedArtifactSchema = createSelectSchema(generatedArtifacts, {
  byteLength: () => NonNegativeIntegerSchema,
  createdAt: () => UtcIsoTimestampSchema,
  generatedAt: () => UtcIsoTimestampSchema,
  kind: () => ArtifactKindSchema,
  publicationVersion: () => PositiveIntegerSchema,
  status: () => ArtifactStatusSchema,
  updatedAt: () => UtcIsoTimestampSchema,
})
export type GeneratedArtifact = typeof generatedArtifacts.$inferSelect

export const PdfGenerationOutboxSchema = createSelectSchema(
  pdfGenerationOutbox,
  {
    attempts: () => NonNegativeIntegerSchema,
    createdAt: () => UtcIsoTimestampSchema,
    dispatchedAt: () => Schema.NullOr(UtcIsoTimestampSchema),
    lastAttemptAt: () => Schema.NullOr(UtcIsoTimestampSchema),
    messageVersion: () => PositiveIntegerSchema,
    updatedAt: () => UtcIsoTimestampSchema,
  }
)
export type PdfGenerationOutbox = typeof pdfGenerationOutbox.$inferSelect
