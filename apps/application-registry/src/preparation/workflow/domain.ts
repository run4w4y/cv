import {
  ApplicationResponseSchema,
  ContentEntryResponseSchema,
  ContentRevisionResultResponseSchema,
  JobPostingSnapshotResponseSchema,
} from '@cv/application-registry-api-contract'
import { CvDocumentV1Schema } from '@cv/contracts/document'
import { CvLocaleSchema, FactsCatalogueV1Schema } from '@cv/contracts/facts'
import { Schema } from 'effect'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as Workflow from 'effect/unstable/workflow/Workflow'

import { CoverLetterDocumentSchema } from '../cover-letter-contract'

export const DocumentKindSchema = Schema.Literals(['cv', 'cover_letter'])
export type DocumentKind = typeof DocumentKindSchema.Type

export const HttpUrlSchema = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(2_048)),
  Schema.check(
    Schema.makeFilter((value) => {
      try {
        const url = new URL(value)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return 'Only HTTP(S) job URLs can be prepared.'
        }
        if (url.username !== '' || url.password !== '') {
          return 'Job URLs containing credentials cannot be prepared.'
        }
        return true
      } catch {
        return 'Enter a valid absolute job URL.'
      }
    })
  )
)

export const canonicalPreparationUrl = (value: string): string => {
  const url = new URL(value.trim())
  url.hash = ''
  const href = url.href.endsWith('#') ? url.href.slice(0, -1) : url.href
  return new URL(href).toString()
}

export const maximumPreparationBatchSize = 25

export const PreparationBatchUrlsSchema = Schema.Array(HttpUrlSchema).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(maximumPreparationBatchSize))
)

export const maximumCoverLetterPromptLength = 20_000
export const CoverLetterPromptSchema = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(maximumCoverLetterPromptLength))
)

export const PreparationSourceSchema = Schema.TaggedUnion({
  CaptureUrl: {
    url: HttpUrlSchema,
  },
  ReviewedContext: {
    applicationId: Schema.NonEmptyString,
    factsReleaseId: Schema.NonEmptyString,
    jobSnapshotId: Schema.NonEmptyString,
    url: HttpUrlSchema,
  },
})
export type PreparationSource = typeof PreparationSourceSchema.Type

export const preparationSourceApplicationId = (
  source: PreparationSource
): string | null =>
  source._tag === 'ReviewedContext' ? source.applicationId : null

export const preparationSourceUrl = (source: PreparationSource): string =>
  source.url

export const PreparationWorkflowInputSchema = Schema.Struct({
  coverLetterPrompt: Schema.NullOr(CoverLetterPromptSchema),
  kind: DocumentKindSchema,
  locale: CvLocaleSchema,
  modelId: Schema.NonEmptyString,
  runId: Schema.NonEmptyString,
  source: PreparationSourceSchema,
})
export interface PreparationWorkflowInput
  extends Schema.Schema.Type<typeof PreparationWorkflowInputSchema> {}

export const JobRequirementSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  priority: Schema.Literals(['required', 'preferred', 'context']),
  text: Schema.NonEmptyString,
})

export const JobAnalysisSchema = Schema.Struct({
  company: Schema.NullOr(Schema.NonEmptyString),
  keywords: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(40))
  ),
  location: Schema.NullOr(Schema.NonEmptyString),
  requirements: Schema.Array(JobRequirementSchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(30))
  ),
  responsibilities: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(30))
  ),
  role: Schema.NonEmptyString,
  summary: Schema.NonEmptyString,
})
export interface JobAnalysis
  extends Schema.Schema.Type<typeof JobAnalysisSchema> {}

export const EvidenceMatchSchema = Schema.Struct({
  factIds: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(24))
  ),
  rationale: Schema.NonEmptyString,
  requirementId: Schema.NonEmptyString,
})

export const EvidencePlanSchema = Schema.Struct({
  matches: Schema.Array(EvidenceMatchSchema).pipe(
    Schema.check(Schema.isMaxLength(30))
  ),
  strategy: Schema.NonEmptyString,
  uncoveredRequirementIds: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(30))
  ),
})
export interface EvidencePlan
  extends Schema.Schema.Type<typeof EvidencePlanSchema> {}

export const SectionBriefSchema = Schema.Struct({
  factIds: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(32))
  ),
  notes: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(16))
  ),
  objective: Schema.NonEmptyString,
  sectionId: Schema.NonEmptyString,
})
export interface SectionBrief
  extends Schema.Schema.Type<typeof SectionBriefSchema> {}

export const AiUsageSchema = Schema.Struct({
  inputTokens: Schema.NullOr(Schema.Number),
  outputTokens: Schema.NullOr(Schema.Number),
  totalTokens: Schema.NullOr(Schema.Number),
})

export const AiStageMetadataSchema = Schema.Struct({
  finishReason: Schema.NonEmptyString,
  modelId: Schema.NonEmptyString,
  stage: Schema.NonEmptyString,
  usage: AiUsageSchema,
})
export interface AiStageMetadata
  extends Schema.Schema.Type<typeof AiStageMetadataSchema> {}

export const JobAnalysisResultSchema = Schema.Struct({
  analysis: JobAnalysisSchema,
  metadata: AiStageMetadataSchema,
})
export interface JobAnalysisResult
  extends Schema.Schema.Type<typeof JobAnalysisResultSchema> {}

export const EvidencePlanResultSchema = Schema.Struct({
  metadata: AiStageMetadataSchema,
  plan: EvidencePlanSchema,
})
export interface EvidencePlanResult
  extends Schema.Schema.Type<typeof EvidencePlanResultSchema> {}

export const SectionBriefResultSchema = Schema.Struct({
  brief: SectionBriefSchema,
  metadata: AiStageMetadataSchema,
})
export interface SectionBriefResult
  extends Schema.Schema.Type<typeof SectionBriefResultSchema> {}

export const PreparationBootstrapSchema = Schema.Struct({
  application: ApplicationResponseSchema,
  entry: ContentEntryResponseSchema,
  factsCatalogue: FactsCatalogueV1Schema,
  factsReleaseId: Schema.NonEmptyString,
  jobContext: Schema.Json,
  jobSnapshot: JobPostingSnapshotResponseSchema,
})
export interface PreparationBootstrap
  extends Schema.Schema.Type<typeof PreparationBootstrapSchema> {}

export const GeneratedCandidateSchema = Schema.TaggedUnion({
  Cv: {
    document: CvDocumentV1Schema,
    metadata: Schema.Array(AiStageMetadataSchema),
  },
  CoverLetter: {
    document: CoverLetterDocumentSchema,
    metadata: Schema.Array(AiStageMetadataSchema),
  },
})
export type GeneratedCandidate = typeof GeneratedCandidateSchema.Type

export const candidateMatchesDocumentKind = (
  candidate: GeneratedCandidate,
  kind: DocumentKind
): boolean =>
  kind === 'cv' ? candidate._tag === 'Cv' : candidate._tag === 'CoverLetter'

export const SavedCandidateSchema = Schema.Struct({
  application: ApplicationResponseSchema,
  candidate: GeneratedCandidateSchema,
  result: ContentRevisionResultResponseSchema,
})
export interface SavedCandidate
  extends Schema.Schema.Type<typeof SavedCandidateSchema> {}

export const ReviewDecisionSchema = Schema.TaggedUnion({
  Approved: {
    revisionId: Schema.NonEmptyString,
  },
  Rejected: {
    reason: Schema.NonEmptyString,
  },
})
export type ReviewDecision = typeof ReviewDecisionSchema.Type

export const HumanReview = DurableDeferred.make(
  'ApplicationPreparation/HumanReview',
  { success: ReviewDecisionSchema }
)

export const PreparationWorkflowResultSchema = Schema.Struct({
  applicationId: Schema.NonEmptyString,
  revisionId: Schema.NullOr(Schema.NonEmptyString),
  runId: Schema.NonEmptyString,
  status: Schema.Literals(['approved', 'rejected']),
})
export interface PreparationWorkflowResult
  extends Schema.Schema.Type<typeof PreparationWorkflowResultSchema> {}

export class PreparationWorkflowError extends Schema.TaggedErrorClass<PreparationWorkflowError>()(
  'PreparationWorkflowError',
  {
    message: Schema.String,
    stage: Schema.String,
  }
) {}

export const PrepareApplicationWorkflow = Workflow.make(
  'PrepareApplication/v1',
  {
    payload: PreparationWorkflowInputSchema,
    success: PreparationWorkflowResultSchema,
    error: PreparationWorkflowError,
    idempotencyKey: ({ runId }) => runId,
  }
)

export type PreparationStage =
  | 'queued'
  | 'application'
  | 'capture'
  | 'analysis'
  | 'evidence'
  | 'briefs'
  | 'composition'
  | 'validation'
  | 'saving'
  | 'review'
  | 'complete'

type PreparationRunBase = {
  readonly applicationId: string | null
  readonly kind: DocumentKind
  readonly locale: string
  readonly message: string
  readonly runId: string
  readonly stage: PreparationStage
  readonly url: string
}

/**
 * The browser projection is a tagged state machine. Every variant keeps the
 * common display fields, while candidate, token, execution and error values
 * are present only where the state can truthfully own them.
 */
export type PreparationRun = PreparationRunBase &
  (
    | {
        readonly candidate: null
        readonly error: null
        readonly executionId: string | null
        readonly reviewToken: null
        readonly stage: 'queued'
        readonly status: 'queued'
      }
    | {
        readonly candidate: null
        readonly error: null
        readonly executionId: string
        readonly reviewToken: null
        readonly status: 'running'
      }
    | {
        readonly candidate: SavedCandidate
        readonly error: null
        readonly executionId: string
        readonly reviewToken: DurableDeferred.Token
        readonly stage: 'review'
        readonly status: 'awaiting_review'
      }
    | {
        readonly candidate: SavedCandidate
        readonly error: null
        readonly executionId: string
        readonly reviewToken: null
        readonly stage: 'review'
        readonly status: 'review_submitted'
      }
    | {
        readonly candidate: SavedCandidate | null
        readonly error: null
        readonly executionId: string
        readonly reviewToken: DurableDeferred.Token | null
        readonly status: 'cancelling'
      }
    | {
        readonly candidate: SavedCandidate
        readonly error: null
        readonly executionId: string
        readonly reviewToken: null
        readonly stage: 'complete'
        readonly status: 'approved' | 'rejected'
      }
    | {
        readonly candidate: SavedCandidate | null
        readonly error: string
        readonly executionId: string | null
        readonly reviewToken: null
        readonly status: 'failed'
      }
    | {
        readonly candidate: SavedCandidate | null
        readonly error: null
        readonly executionId: string | null
        readonly reviewToken: null
        readonly status: 'cancelled'
      }
  )

export type PreparationRunStatus = PreparationRun['status']

export type StartPreparationInput = Omit<PreparationWorkflowInput, 'runId'>

export type StartPreparationResult = {
  readonly executionId: string
  readonly runId: string
}

export type StartPreparationBatchInput = {
  readonly coverLetterPrompt: string | null
  readonly kind: DocumentKind
  readonly locale: typeof CvLocaleSchema.Type
  readonly modelId: string
  readonly urls: ReadonlyArray<string>
}
