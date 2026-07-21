import { Schema } from 'effect'

export const JobRequirementSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  priority: Schema.Literals(['required', 'preferred', 'context']),
  text: Schema.NonEmptyString,
})

const uniqueRequirementIds = Schema.makeFilter(
  (requirements: ReadonlyArray<typeof JobRequirementSchema.Type>) => {
    const seen = new Set<string>()
    return requirements.flatMap((requirement, index) => {
      if (seen.has(requirement.id)) {
        return [
          {
            path: [index, 'id'],
            issue: `Duplicate requirement identifier: ${requirement.id}`,
          },
        ]
      }
      seen.add(requirement.id)
      return []
    })
  }
)

export const JobAnalysisSchema = Schema.Struct({
  company: Schema.NullOr(Schema.NonEmptyString),
  keywords: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(40))
  ),
  location: Schema.NullOr(Schema.NonEmptyString),
  requirements: Schema.Array(JobRequirementSchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(30)),
    Schema.check(uniqueRequirementIds)
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
  factIds: Schema.UniqueArray(Schema.NonEmptyString).pipe(
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
  uncoveredRequirementIds: Schema.UniqueArray(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(30))
  ),
})
export interface EvidencePlan
  extends Schema.Schema.Type<typeof EvidencePlanSchema> {}

export const SectionBriefSchema = Schema.Struct({
  factIds: Schema.UniqueArray(Schema.NonEmptyString).pipe(
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

export const GenerationUsageSchema = Schema.Struct({
  inputTokens: Schema.NullOr(Schema.Number),
  outputTokens: Schema.NullOr(Schema.Number),
  totalTokens: Schema.NullOr(Schema.Number),
})

export const GenerationStageMetadataSchema = Schema.Struct({
  executor: Schema.NonEmptyString,
  stage: Schema.NonEmptyString,
  usage: GenerationUsageSchema,
})
export interface GenerationStageMetadata
  extends Schema.Schema.Type<typeof GenerationStageMetadataSchema> {}

export const JobAnalysisResultSchema = Schema.Struct({
  analysis: JobAnalysisSchema,
  metadata: GenerationStageMetadataSchema,
})
export interface JobAnalysisResult
  extends Schema.Schema.Type<typeof JobAnalysisResultSchema> {}

export const EvidencePlanResultSchema = Schema.Struct({
  metadata: GenerationStageMetadataSchema,
  plan: EvidencePlanSchema,
})
export interface EvidencePlanResult
  extends Schema.Schema.Type<typeof EvidencePlanResultSchema> {}

export const SectionBriefResultSchema = Schema.Struct({
  brief: SectionBriefSchema,
  metadata: GenerationStageMetadataSchema,
})
export interface SectionBriefResult
  extends Schema.Schema.Type<typeof SectionBriefResultSchema> {}
