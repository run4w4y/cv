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

export type StartPreparationResult = {
  readonly batchId: string
  readonly runId: string
}

export type StartPreparationBatchInput = {
  readonly coverLetterPrompt: string | null
  readonly cvGenerationGuidance: typeof CvGenerationGuidanceV1Schema.Type | null
  readonly kind: DocumentKind
  readonly locale: typeof CvLocaleSchema.Type
  readonly urls: ReadonlyArray<string>
}
