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

const PreparationWorkflowInputStructureSchema = Schema.Struct({
  coverLetterPrompt: Schema.NullOr(CoverLetterPromptSchema),
  cvGenerationGuidance: Schema.NullOr(CvGenerationGuidanceV1Schema),
  kind: DocumentKindSchema,
  locale: CvLocaleSchema,
  runId: Schema.NonEmptyString,
  source: PreparationSourceSchema,
})

export const PreparationWorkflowInputSchema =
  PreparationWorkflowInputStructureSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (input) =>
          input.kind === 'cv'
            ? input.cvGenerationGuidance !== null
            : input.cvGenerationGuidance === null,
        {
          message:
            'CV generation guidance must be present for CV runs and absent for cover-letter runs.',
        }
      )
    )
  )
export interface PreparationWorkflowInput
  extends Schema.Schema.Type<typeof PreparationWorkflowInputSchema> {}

export type StartPreparationInput = Omit<PreparationWorkflowInput, 'runId'>

export const PreparationArtifactRunIdsSchema = Schema.Struct({
  coverLetter: Schema.NullOr(Schema.NonEmptyString),
  cv: Schema.NullOr(Schema.NonEmptyString),
})
export interface PreparationArtifactRunIds
  extends Schema.Schema.Type<typeof PreparationArtifactRunIdsSchema> {}

const PreparationJobInputStructureSchema = Schema.Struct({
  coverLetterPrompt: Schema.NullOr(CoverLetterPromptSchema),
  cvGenerationGuidance: Schema.NullOr(CvGenerationGuidanceV1Schema),
  jobId: Schema.NonEmptyString,
  locale: CvLocaleSchema,
  runIds: PreparationArtifactRunIdsSchema,
  source: PreparationSourceSchema,
})

export const PreparationJobInputSchema =
  PreparationJobInputStructureSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (input) =>
          input.runIds.cv !== null || input.runIds.coverLetter !== null,
        {
          message: 'A preparation job must request at least one artifact.',
        }
      )
    ),
    Schema.check(
      Schema.makeFilter(
        (input) =>
          input.runIds.cv === null
            ? input.cvGenerationGuidance === null
            : input.cvGenerationGuidance !== null,
        {
          message:
            'CV generation guidance must be present exactly when a CV artifact is requested.',
        }
      )
    ),
    Schema.check(
      Schema.makeFilter(
        (input) =>
          input.source._tag !== 'CaptureUrl' || input.runIds.cv !== null,
        {
          message:
            'URL preparation jobs must include a CV; the cover letter is an optional dependent artifact.',
        }
      )
    )
  )
export interface PreparationJobInput
  extends Schema.Schema.Type<typeof PreparationJobInputSchema> {}

const isPreparationJobInput = Schema.is(PreparationJobInputSchema)
const isPreparationArtifactInput = Schema.is(PreparationWorkflowInputSchema)

export const PreparationWorkflowPayloadSchema = Schema.Struct({
  coverLetterPrompt: Schema.NullOr(CoverLetterPromptSchema),
  cvGenerationGuidance: Schema.NullOr(CvGenerationGuidanceV1Schema),
  jobId: Schema.optionalKey(Schema.NonEmptyString),
  kind: Schema.optionalKey(DocumentKindSchema),
  locale: CvLocaleSchema,
  runId: Schema.optionalKey(Schema.NonEmptyString),
  runIds: Schema.optionalKey(PreparationArtifactRunIdsSchema),
  source: PreparationSourceSchema,
}).pipe(
  Schema.check(
    Schema.makeFilter(
      (input) =>
        isPreparationJobInput(input) || isPreparationArtifactInput(input),
      {
        message:
          'A workflow payload must describe either one preparation job or one legacy artifact run.',
      }
    )
  )
)
export interface PreparationWorkflowPayload
  extends Schema.Schema.Type<typeof PreparationWorkflowPayloadSchema> {}

export const normalizePreparationJobInput = (
  input: PreparationWorkflowPayload
): PreparationJobInput => {
  if (isPreparationJobInput(input)) return input
  if (isPreparationArtifactInput(input)) {
    return {
      coverLetterPrompt: input.coverLetterPrompt,
      cvGenerationGuidance: input.cvGenerationGuidance,
      jobId: input.runId,
      locale: input.locale,
      runIds: {
        coverLetter: input.kind === 'cover_letter' ? input.runId : null,
        cv: input.kind === 'cv' ? input.runId : null,
      },
      source: input.source,
    }
  }
  throw new Error('Invalid decoded preparation workflow payload.')
}

export const preparationJobArtifactInput = (
  input: PreparationJobInput,
  kind: DocumentKind
): PreparationWorkflowInput | null => {
  const runId = kind === 'cv' ? input.runIds.cv : input.runIds.coverLetter
  if (runId === null) return null
  return {
    coverLetterPrompt: kind === 'cover_letter' ? input.coverLetterPrompt : null,
    cvGenerationGuidance: kind === 'cv' ? input.cvGenerationGuidance : null,
    kind,
    locale: input.locale,
    runId,
    source: input.source,
  }
}

export const preparationJobArtifactInputs = (
  input: PreparationJobInput
): ReadonlyArray<PreparationWorkflowInput> => {
  const cv = preparationJobArtifactInput(input, 'cv')
  const coverLetter = preparationJobArtifactInput(input, 'cover_letter')
  return [
    ...(cv === null ? [] : [cv]),
    ...(coverLetter === null ? [] : [coverLetter]),
  ]
}

export type StartPreparationResult = {
  readonly batchId: string
  readonly jobId?: string
  readonly runId: string
}

export type StartPreparationBatchInput = {
  readonly coverLetterPrompt: string | null
  readonly cvGenerationGuidance: typeof CvGenerationGuidanceV1Schema.Type
  readonly includeCoverLetter: boolean
  readonly locale: typeof CvLocaleSchema.Type
  readonly urls: ReadonlyArray<string>
}
