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
  educationDatesRequired: Schema.Boolean,
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

export const RequirementEvidenceSchema = Schema.Struct({
  evidenceIds: Schema.UniqueArray(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(24))
  ),
  requirementId: Schema.NonEmptyString,
})

export const EvidencePlanSchema = Schema.Struct({
  requirements: Schema.Array(RequirementEvidenceSchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(30))
  ),
})
export interface EvidencePlan
  extends Schema.Schema.Type<typeof EvidencePlanSchema> {}

export const CvAuthoringItemSchema = Schema.Struct({
  evidenceIds: Schema.UniqueArray(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(32))
  ),
  id: Schema.NonEmptyString,
})
export interface CvAuthoringItem
  extends Schema.Schema.Type<typeof CvAuthoringItemSchema> {}

export const CvAuthoringPlanSchema = Schema.Struct({
  additionalEvidenceIds: Schema.UniqueArray(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(16))
  ),
  education: Schema.Array(CvAuthoringItemSchema).pipe(
    Schema.check(Schema.isMaxLength(4))
  ),
  experience: Schema.Array(CvAuthoringItemSchema).pipe(
    Schema.check(Schema.isMaxLength(5))
  ),
  profileEvidenceIds: Schema.UniqueArray(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(16))
  ),
  projects: Schema.Array(CvAuthoringItemSchema).pipe(
    Schema.check(Schema.isMaxLength(3))
  ),
  skillGroups: Schema.Array(CvAuthoringItemSchema).pipe(
    Schema.check(Schema.isMaxLength(8))
  ),
})
export interface CvAuthoringPlan
  extends Schema.Schema.Type<typeof CvAuthoringPlanSchema> {}

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

export const CvAuthoringPlanResultSchema = Schema.Struct({
  metadata: GenerationStageMetadataSchema,
  plan: CvAuthoringPlanSchema,
})
export interface CvAuthoringPlanResult
  extends Schema.Schema.Type<typeof CvAuthoringPlanResultSchema> {}
