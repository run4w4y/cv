import {
  ContentEntryResponseSchema,
  CvLinkResponseSchema,
  PdfJobResponseSchema,
} from '@cv/application-registry-api-contract'
import type { ContentEntry, CvLink } from '@cv/application-registry-entity'
import { Schema } from 'effect'
import * as Workflow from 'effect/unstable/workflow/Workflow'

export const CvPublicationStageSchema = Schema.Literals([
  'input',
  'enable-page',
  'start-pdf',
])
export type CvPublicationStage = typeof CvPublicationStageSchema.Type

export class CvPublicationWorkflowError extends Schema.TaggedErrorClass<CvPublicationWorkflowError>()(
  'CvPublicationWorkflowError',
  {
    message: Schema.NonEmptyString,
    stage: CvPublicationStageSchema,
  }
) {}

export const CvPublicationWorkflowInputSchema = Schema.Struct({
  applicationId: Schema.NonEmptyString,
  entry: ContentEntryResponseSchema,
  expectedPublicationVersion: Schema.Int.pipe(
    Schema.check(Schema.isGreaterThan(0))
  ),
  runId: Schema.NonEmptyString,
}).pipe(
  Schema.check(
    Schema.makeFilter((input) => {
      if (input.entry.applicationId !== input.applicationId) {
        return 'The content entry does not belong to this application.'
      }
      if (input.entry.kind !== 'cv') {
        return 'Only CV content entries can be published.'
      }
      if (input.entry.approvedRevisionId === null) {
        return 'Approve a CV revision before publishing it.'
      }
      return true
    })
  )
)
export interface CvPublicationWorkflowInput
  extends Schema.Schema.Type<typeof CvPublicationWorkflowInputSchema> {}

export const CvPublicationWorkflowResultSchema = Schema.Struct({
  applicationId: Schema.NonEmptyString,
  entryId: Schema.NonEmptyString,
  job: Schema.NullOr(PdfJobResponseSchema),
  link: CvLinkResponseSchema,
  pdfStartError: Schema.NullOr(Schema.NonEmptyString),
  runId: Schema.NonEmptyString,
})
export interface CvPublicationWorkflowResult
  extends Schema.Schema.Type<typeof CvPublicationWorkflowResultSchema> {}

export const PublishCvWorkflow = Workflow.make('PublishCv/v2', {
  payload: CvPublicationWorkflowInputSchema,
  success: CvPublicationWorkflowResultSchema,
  error: CvPublicationWorkflowError,
  idempotencyKey: ({ runId }) => runId,
})

export type StartCvPublicationInput = {
  readonly applicationId: string
  readonly entry: ContentEntry
  readonly expectedPublicationVersion: number
}

export type StartCvPublicationResult = {
  readonly executionId: string
  readonly runId: string
}

export type CvPublicationIdentity = {
  readonly applicationId: string
  readonly entryId: string
}

type RunBase = CvPublicationIdentity & {
  readonly executionId: string
  readonly runId: string
}

export type ActiveCvPublicationRun =
  | (RunBase & {
      readonly _tag: 'Queued'
      readonly message: string
    })
  | (RunBase & {
      readonly _tag: 'PublishingLink'
      readonly message: string
    })
  | (RunBase & {
      readonly _tag: 'StartingPdf'
      readonly link: CvLink
      readonly message: string
    })

export type CvPublicationRun =
  | ActiveCvPublicationRun
  | (RunBase & {
      readonly _tag: 'Published'
      readonly message: string
      readonly result: CvPublicationWorkflowResult
    })
  | (RunBase & {
      readonly _tag: 'Failed'
      readonly error: CvPublicationWorkflowError
      readonly message: string
    })
  | (RunBase & {
      readonly _tag: 'Cancelling'
      readonly message: string
      readonly previous: ActiveCvPublicationRun
    })
  | (RunBase & {
      readonly _tag: 'Cancelled'
      readonly message: string
    })

export const cvPublicationIdentityKey = (
  identity: CvPublicationIdentity
): string =>
  [identity.applicationId, identity.entryId]
    .map((value) => encodeURIComponent(value))
    .join('/')

export const publicationRunResult = (
  run: CvPublicationRun | null
): CvPublicationWorkflowResult | null =>
  run?._tag === 'Published' ? run.result : null
