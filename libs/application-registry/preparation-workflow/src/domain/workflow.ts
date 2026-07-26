import { Schema } from 'effect'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as Workflow from 'effect/unstable/workflow/Workflow'

import { DocumentKindSchema, PreparationWorkflowPayloadSchema } from './input'

export const ArtifactApprovalSchema = Schema.Struct({
  revisionId: Schema.NonEmptyString,
})
export interface ArtifactApproval
  extends Schema.Schema.Type<typeof ArtifactApprovalSchema> {}

export type ApproveArtifactInput = {
  readonly artifact: typeof DocumentKindSchema.Type
  readonly jobId: string
  readonly revisionId: string
}

export const CvApproval = DurableDeferred.make(
  'ApplicationPreparation/Approval/cv',
  { success: ArtifactApprovalSchema }
)

export const CoverLetterApproval = DurableDeferred.make(
  'ApplicationPreparation/Approval/cover-letter',
  { success: ArtifactApprovalSchema }
)

export const preparationApprovalDeferred = (
  kind: typeof DocumentKindSchema.Type
) => (kind === 'cv' ? CvApproval : CoverLetterApproval)

export const PreparationArtifactWorkflowResultSchema = Schema.Struct({
  kind: DocumentKindSchema,
  revisionId: Schema.NullOr(Schema.NonEmptyString),
  status: Schema.Literals(['approved', 'failed']),
})
export interface PreparationArtifactWorkflowResult
  extends Schema.Schema.Type<typeof PreparationArtifactWorkflowResultSchema> {}

export const PreparationWorkflowResultSchema = Schema.Struct({
  applicationId: Schema.NonEmptyString,
  artifacts: Schema.Array(PreparationArtifactWorkflowResultSchema),
  jobId: Schema.NonEmptyString,
  status: Schema.Literals(['completed', 'failed', 'mixed']),
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
  'PrepareApplicationJob/v6',
  {
    payload: PreparationWorkflowPayloadSchema,
    success: PreparationWorkflowResultSchema,
    error: PreparationWorkflowError,
    idempotencyKey: (input) => input.jobId,
  }
)
