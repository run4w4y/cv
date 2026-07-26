import { HttpUrlSchema } from '@cv/application-registry-entity'
import { CvGenerationGuidanceV1Schema } from '@cv/contracts/document'
import { CvLocaleSchema } from '@cv/contracts/facts'
import { Schema } from 'effect'

export { HttpUrlSchema } from '@cv/application-registry-entity'

export const DocumentKindSchema = Schema.Literals(['cv', 'cover_letter'])
export type DocumentKind = typeof DocumentKindSchema.Type

export const canonicalPreparationUrl = (value: string): string => {
  const url = new URL(value.trim())
  url.hash = ''
  const href = url.href.endsWith('#') ? url.href.slice(0, -1) : url.href
  return new URL(href).toString()
}

export const maximumPreparationBatchSize = 25

export const PreparationBatchTargetsSchema = Schema.Array(
  Schema.suspend((): typeof AiWorkflowTargetSchema => AiWorkflowTargetSchema)
).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(maximumPreparationBatchSize))
)

export const maximumCoverLetterPromptLength = 20_000
export const CoverLetterPromptSchema = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(maximumCoverLetterPromptLength))
)

/**
 * Every workflow enters through the same target contract. A posting URL creates
 * an application during the shared application node; an existing application
 * carries the reviewed snapshot and facts pins required to reproduce context.
 */
export const AiWorkflowTargetSchema = Schema.TaggedUnion({
  ExistingApplication: {
    applicationId: Schema.NonEmptyString,
    factsReleaseId: Schema.NonEmptyString,
    jobSnapshotId: Schema.NonEmptyString,
    url: HttpUrlSchema,
  },
  PostingUrl: {
    url: HttpUrlSchema,
  },
})
export type AiWorkflowTarget = typeof AiWorkflowTargetSchema.Type

export const aiWorkflowTargetApplicationId = (
  target: AiWorkflowTarget
): string | null =>
  target._tag === 'ExistingApplication' ? target.applicationId : null

export const aiWorkflowTargetUrl = (target: AiWorkflowTarget): string =>
  target.url

export const CvArtifactRequestSchema = Schema.Struct({
  generationGuidance: CvGenerationGuidanceV1Schema,
})
export interface CvArtifactRequest
  extends Schema.Schema.Type<typeof CvArtifactRequestSchema> {}

export const CoverLetterArtifactRequestSchema = Schema.Struct({
  prompt: CoverLetterPromptSchema,
})
export interface CoverLetterArtifactRequest
  extends Schema.Schema.Type<typeof CoverLetterArtifactRequestSchema> {}

export const PreparationArtifactRequestsSchema = Schema.Struct({
  coverLetter: Schema.NullOr(CoverLetterArtifactRequestSchema),
  cv: Schema.NullOr(CvArtifactRequestSchema),
}).pipe(
  Schema.check(
    Schema.makeFilter(
      (artifacts) => artifacts.cv !== null || artifacts.coverLetter !== null,
      { message: 'An AI workflow job must request at least one artifact.' }
    )
  )
)
export interface PreparationArtifactRequests
  extends Schema.Schema.Type<typeof PreparationArtifactRequestsSchema> {}

const PreparationJobInputStructureSchema = Schema.Struct({
  artifacts: PreparationArtifactRequestsSchema,
  jobId: Schema.NonEmptyString,
  locale: CvLocaleSchema,
  target: AiWorkflowTargetSchema,
})

export const PreparationJobInputSchema =
  PreparationJobInputStructureSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (input) =>
          input.target._tag !== 'PostingUrl' || input.artifacts.cv !== null,
        {
          message:
            'Posting URL jobs must include a CV; a cover letter may depend on that CV.',
        }
      )
    )
  )
export interface PreparationJobInput
  extends Schema.Schema.Type<typeof PreparationJobInputSchema> {}

export const PreparationWorkflowPayloadSchema = PreparationJobInputSchema
export interface PreparationWorkflowPayload extends PreparationJobInput {}

export type CreateAiWorkflowJobInput = Omit<PreparationJobInput, 'jobId'>

export type CreateAiWorkflowBatchInput = {
  readonly artifacts: PreparationArtifactRequests
  readonly locale: typeof CvLocaleSchema.Type
  readonly targets: ReadonlyArray<AiWorkflowTarget>
}

export type CreateAiWorkflowJobResult = {
  readonly batchId: string
  readonly jobId: string
}

/**
 * Artifact execution inputs are derived from the authoritative job payload.
 * They are never accepted at the workflow boundary or stored as top-level
 * runs. `runId` remains an internal persistence-operation correlation key.
 */
export type PreparationSource =
  | {
      readonly _tag: 'CaptureUrl'
      readonly url: string
    }
  | {
      readonly _tag: 'ReviewedContext'
      readonly applicationId: string
      readonly factsReleaseId: string
      readonly jobSnapshotId: string
      readonly url: string
    }

type PreparationArtifactInput = {
  readonly locale: typeof CvLocaleSchema.Type
  readonly runId: string
  readonly source: PreparationSource
}

export type CvPreparationInput = PreparationArtifactInput & {
  readonly generationGuidance: typeof CvGenerationGuidanceV1Schema.Type
  readonly kind: 'cv'
}

export type CoverLetterPreparationInput = PreparationArtifactInput & {
  readonly kind: 'cover_letter'
  readonly prompt: string
}

export type PreparationWorkflowInput =
  | CvPreparationInput
  | CoverLetterPreparationInput

export const preparationArtifactId = (
  jobId: string,
  kind: DocumentKind
): string => `${jobId}:${kind === 'cv' ? 'cv' : 'cover-letter'}`

const preparationSource = (input: PreparationJobInput): PreparationSource =>
  input.target._tag === 'PostingUrl'
    ? {
        _tag: 'CaptureUrl',
        url: input.target.url,
      }
    : {
        _tag: 'ReviewedContext',
        applicationId: input.target.applicationId,
        factsReleaseId: input.target.factsReleaseId,
        jobSnapshotId: input.target.jobSnapshotId,
        url: input.target.url,
      }

export const preparationJobCvInput = (
  input: PreparationJobInput
): CvPreparationInput | null =>
  input.artifacts.cv === null
    ? null
    : {
        generationGuidance: input.artifacts.cv.generationGuidance,
        kind: 'cv',
        locale: input.locale,
        runId: preparationArtifactId(input.jobId, 'cv'),
        source: preparationSource(input),
      }

export const preparationJobCoverLetterInput = (
  input: PreparationJobInput
): CoverLetterPreparationInput | null =>
  input.artifacts.coverLetter === null
    ? null
    : {
        kind: 'cover_letter',
        locale: input.locale,
        prompt: input.artifacts.coverLetter.prompt,
        runId: preparationArtifactId(input.jobId, 'cover_letter'),
        source: preparationSource(input),
      }

export const preparationJobArtifactInputs = (
  input: PreparationJobInput
): ReadonlyArray<PreparationWorkflowInput> => {
  const cv = preparationJobCvInput(input)
  const coverLetter = preparationJobCoverLetterInput(input)
  return [
    ...(cv === null ? [] : [cv]),
    ...(coverLetter === null ? [] : [coverLetter]),
  ]
}

export const preparationSourceApplicationId = (
  source: PreparationSource
): string | null =>
  source._tag === 'ReviewedContext' ? source.applicationId : null

export const preparationSourceUrl = (source: PreparationSource): string =>
  source.url
