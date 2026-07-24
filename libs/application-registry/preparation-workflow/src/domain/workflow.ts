import { Schema } from 'effect'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as Workflow from 'effect/unstable/workflow/Workflow'

import { DocumentKindSchema, PreparationWorkflowPayloadSchema } from './input'

export const ReviewDecisionSchema = Schema.TaggedUnion({
  Approved: {
    revisionId: Schema.NonEmptyString,
  },
  Rejected: {
    reason: Schema.NonEmptyString,
  },
})
export type ReviewDecision = typeof ReviewDecisionSchema.Type

export type SubmitPreparationReviewInput = {
  readonly decision: ReviewDecision
  readonly runId: string
}

export const CvReview = DurableDeferred.make(
  'ApplicationPreparation/Review/cv',
  { success: ReviewDecisionSchema }
)

export const CoverLetterReview = DurableDeferred.make(
  'ApplicationPreparation/Review/cover-letter',
  { success: ReviewDecisionSchema }
)

/** @deprecated Use the artifact-specific review deferred. */
export const HumanReview = CvReview

export const preparationReviewDeferred = (
  kind: typeof DocumentKindSchema.Type
) => (kind === 'cv' ? CvReview : CoverLetterReview)

export const PreparationArtifactWorkflowResultSchema = Schema.Struct({
  kind: DocumentKindSchema,
  revisionId: Schema.NullOr(Schema.NonEmptyString),
  runId: Schema.NonEmptyString,
  status: Schema.Literals(['approved', 'rejected', 'failed']),
})
export interface PreparationArtifactWorkflowResult
  extends Schema.Schema.Type<typeof PreparationArtifactWorkflowResultSchema> {}

export const PreparationWorkflowResultSchema = Schema.Struct({
  applicationId: Schema.NonEmptyString,
  artifacts: Schema.Array(PreparationArtifactWorkflowResultSchema),
  jobId: Schema.NonEmptyString,
  revisionId: Schema.optionalKey(Schema.NullOr(Schema.NonEmptyString)),
  runId: Schema.optionalKey(Schema.NonEmptyString),
  status: Schema.optionalKey(Schema.Literals(['approved', 'rejected'])),
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
  'PrepareApplicationJob/v3',
  {
    payload: PreparationWorkflowPayloadSchema,
    success: PreparationWorkflowResultSchema,
    error: PreparationWorkflowError,
    idempotencyKey: (input) =>
      input.jobId ?? input.runId ?? 'invalid-preparation-payload',
  }
)
