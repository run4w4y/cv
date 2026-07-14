import { Schema } from 'effect'
import { FitScoreSchema } from './constraints'

export const fitAssessmentRubricVersion = 'application-fit-v1' as const

const dimensionScore = (maximum: number) =>
  FitScoreSchema.pipe(Schema.check(Schema.isLessThanOrEqualTo(maximum)))

export const FitAssessmentDimensionsSchema = Schema.Struct({
  coreExperience: dimensionScore(25),
  hardRequirements: dimensionScore(40),
  practicalEligibility: dimensionScore(10),
  preferredSignals: dimensionScore(10),
  seniorityAndScope: dimensionScore(15),
})

export type FitAssessmentDimensions = Schema.Schema.Type<
  typeof FitAssessmentDimensionsSchema
>

const FitAssessmentFieldsSchema = Schema.Struct({
  dimensions: FitAssessmentDimensionsSchema,
  gaps: Schema.Array(Schema.String),
  hardBlockers: Schema.Array(Schema.String),
  rationale: Schema.String,
  rubricVersion: Schema.Literal(fitAssessmentRubricVersion),
  score: FitScoreSchema,
  strengths: Schema.Array(Schema.String),
})

export const FitAssessmentSchema = FitAssessmentFieldsSchema.pipe(
  Schema.check(
    Schema.makeFilter((assessment) =>
      Object.values(assessment.dimensions).reduce(
        (total, score) => total + score,
        0
      ) === assessment.score
        ? undefined
        : {
            issue: 'Fit assessment dimensions must sum to score.',
            path: ['score'],
          }
    )
  )
)

export type FitAssessment = Schema.Schema.Type<typeof FitAssessmentSchema>
