import { Schema } from 'effect'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as Workflow from 'effect/unstable/workflow/Workflow'

import { PreparationWorkflowInputSchema } from './input'

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
