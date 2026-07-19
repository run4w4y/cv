import {
  ContentEntryResponseSchema,
  CvLinkResponseSchema,
  GeneratedArtifactResponseSchema,
  type PdfJobResponse,
} from '@cv/application-registry-api-contract'
import type {
  ContentEntry,
  CvLink,
  GeneratedArtifact,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'
import * as Workflow from 'effect/unstable/workflow/Workflow'

const HttpBaseUrlSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => {
      try {
        const parsed = new URL(value)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          ? true
          : 'The public CV base URL must use HTTP(S).'
      } catch {
        return 'Enter a valid absolute public CV base URL.'
      }
    })
  )
)

export const CvPublicationStageSchema = Schema.Literals([
  'input',
  'publish-link',
  'start-pdf',
  'poll-pdf',
  'verify-artifact',
  'compensation',
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
  publicBaseUrl: HttpBaseUrlSchema,
  rendererVersion: Schema.NonEmptyString,
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
  artifact: GeneratedArtifactResponseSchema,
  entryId: Schema.NonEmptyString,
  link: CvLinkResponseSchema,
  runId: Schema.NonEmptyString,
})
export interface CvPublicationWorkflowResult
  extends Schema.Schema.Type<typeof CvPublicationWorkflowResultSchema> {}

export const PublishCvWorkflow = Workflow.make('PublishCv/v1', {
  payload: CvPublicationWorkflowInputSchema,
  success: CvPublicationWorkflowResultSchema,
  error: CvPublicationWorkflowError,
  idempotencyKey: ({ runId }) => runId,
})

export type StartCvPublicationInput = {
  readonly applicationId: string
  readonly entry: ContentEntry
  readonly publicBaseUrl: string
  readonly rendererVersion: string
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
  readonly rendererVersion: string
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
  | (RunBase & {
      readonly _tag: 'PollingPdf'
      readonly link: CvLink
      readonly message: string
      readonly job: PdfJobResponse
    })
  | (RunBase & {
      readonly _tag: 'VerifyingArtifact'
      readonly link: CvLink
      readonly message: string
      readonly job: PdfJobResponse
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

export const verifiedPublicationResult = (
  input: CvPublicationWorkflowInput,
  link: CvLink,
  artifact: GeneratedArtifact,
  jobArtifactId: string
): boolean =>
  input.entry.approvedRevisionId !== null &&
  link.applicationId === input.applicationId &&
  link.contentEntryId === input.entry.id &&
  link.publishedRevisionId === input.entry.approvedRevisionId &&
  link.enabled &&
  artifact.id === jobArtifactId &&
  artifact.cvLinkId === link.id &&
  artifact.contentRevisionId === input.entry.approvedRevisionId &&
  artifact.publicationVersion === link.publicationVersion &&
  artifact.qrTarget === link.publicUrl &&
  artifact.rendererVersion === input.rendererVersion &&
  artifact.status === 'ready'
