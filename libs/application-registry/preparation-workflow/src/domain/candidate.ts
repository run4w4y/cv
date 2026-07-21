import {
  ApplicationSchema,
  ContentEntrySchema,
  ContentRevisionSchema,
  JobPostingSnapshotSchema,
} from '@cv/application-registry-entity'
import {
  CvDocumentV1Schema,
  CvGenerationGuidanceV1Schema,
} from '@cv/contracts/document'
import { FactsCatalogueV1Schema } from '@cv/contracts/facts'
import { Schema } from 'effect'

import { CoverLetterDocumentSchema } from '../cover-letter/contract'
import { GenerationStageMetadataSchema } from './generation'
import type { DocumentKind } from './input'

export const ContentRevisionResultSchema = Schema.Struct({
  entry: ContentEntrySchema,
  revision: ContentRevisionSchema,
})
export interface ContentRevisionResult
  extends Schema.Schema.Type<typeof ContentRevisionResultSchema> {}

export const PreparationBootstrapSchema = Schema.Struct({
  application: ApplicationSchema,
  cvGenerationGuidance: CvGenerationGuidanceV1Schema,
  entry: ContentEntrySchema,
  factsCatalogue: FactsCatalogueV1Schema,
  factsReleaseId: Schema.NonEmptyString,
  jobContext: Schema.Json,
  jobSnapshot: JobPostingSnapshotSchema,
})
export interface PreparationBootstrap
  extends Schema.Schema.Type<typeof PreparationBootstrapSchema> {}

export const GeneratedCandidateSchema = Schema.TaggedUnion({
  Cv: {
    document: CvDocumentV1Schema,
    metadata: Schema.Array(GenerationStageMetadataSchema),
  },
  CoverLetter: {
    document: CoverLetterDocumentSchema,
    metadata: Schema.Array(GenerationStageMetadataSchema),
  },
})
export type GeneratedCandidate = typeof GeneratedCandidateSchema.Type

export const candidateMatchesDocumentKind = (
  candidate: GeneratedCandidate,
  kind: DocumentKind
): boolean =>
  kind === 'cv' ? candidate._tag === 'Cv' : candidate._tag === 'CoverLetter'

export const SavedCandidateSchema = Schema.Struct({
  application: ApplicationSchema,
  candidate: GeneratedCandidateSchema,
  result: ContentRevisionResultSchema,
})
export interface SavedCandidate
  extends Schema.Schema.Type<typeof SavedCandidateSchema> {}
