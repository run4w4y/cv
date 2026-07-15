import {
  ApplicationCompensationInputSchema,
  CurrencyCodeSchema,
  FitAssessmentSchema,
  NonNegativeMinorAmountSchema,
  OpportunityDetailsSchema,
  SubmissionDetailsSchema,
} from '@cv/application-registry-entity'
import { Effect, Schema } from 'effect'
import {
  type CampaignAnalysisPromptContribution,
  type CampaignRecommendationPromptContribution,
  defineCampaignAnalysisContribution,
  defineCampaignRecommendationContribution,
} from '../../../plugins/types'
import { workflowKey, workflowOutput } from '../../../workflow/graph/key'
import type {
  WorkflowFailurePolicy,
  WorkflowStep,
} from '../../../workflow/graph/types'
import { campaignWorkflowStepIds } from '../../../workflow/step-ids'
import { applicationRegistryConflictStepId } from './conflicts'

export const applicationRegistryCampaignPluginId = 'application-registry'

const ApplicationRegistryCompensationSchema = Schema.Struct({
  currencyCode: CurrencyCodeSchema,
  kind: ApplicationCompensationInputSchema.fields.kind,
  maximumMinor: Schema.NullOr(NonNegativeMinorAmountSchema),
  minimumMinor: Schema.NullOr(NonNegativeMinorAmountSchema),
  period: ApplicationCompensationInputSchema.fields.period,
  rawText: Schema.NullOr(Schema.String),
  source: Schema.Literal('job-posting'),
})

export const ApplicationRegistryAnalysisSchema = Schema.Struct({
  applicationUrl: Schema.NullOr(Schema.String),
  compensations: Schema.Array(ApplicationRegistryCompensationSchema),
  details: OpportunityDetailsSchema,
  submissionDetails: SubmissionDetailsSchema,
})

export type ApplicationRegistryAnalysis = Schema.Schema.Type<
  typeof ApplicationRegistryAnalysisSchema
>

const applicationRegistryAnalysisInstructions = `Extract the registry metadata and operational details for this opportunity. Return one object with applicationUrl, submissionDetails, details, and compensations.

- Use null for every unstated scalar field and [] for every unstated list. Do not infer requirements that the posting does not state.

For submissionDetails:
- applicationUrl is the top-level canonical destination for applying. applicationMethod describes how to apply; contactEmail is the application or recruiter address when one is provided.
- applicationQuestions must contain every explicit question or requested written response.
- requiredDocuments must include explicitly requested CV, portfolio, references, certificates, or similar documents.
- coverLetterInstructions contains the posting's exact cover-letter or motivation-note requirements.
- locationRestrictions, visaRequirements, relocation, salary, languageRequirements, deadline, employmentType, and workMode must reflect only what the posting actually says.
- additionalInstructions contains other submission constraints, not general role requirements.

For details (OpportunityDetails):
- Treat geography and work arrangement as independent facts; do not classify opportunities into country-specific variants.
- countryCode is an uppercase ISO 3166-1 alpha-2 code only when the opportunity country is unambiguous.
- region is the posting's state, province, prefecture, city-region, or other sub-country area.
- workMode preserves the posting's work-mode wording. remoteRegion and timezoneOverlap capture separate remote-location and time-overlap restrictions.
- employmentType, languageRequirements, workAuthorization, residenceRequirement, applyFromAbroad, visaSponsorship, and relocationSupport preserve what the posting says without reducing qualified or conditional statements to booleans.

For compensations:
- Return one structured item for each separately stated base salary, total compensation, bonus, equity, or other compensation amount. Return [] when no monetary compensation is stated.
- Keep the posting's original currency. Never convert currencies. currencyCode must be an uppercase ISO 4217 code that is explicit or unambiguous from context.
- minimumMinor and maximumMinor are integer amounts in that currency's minor unit. Expand abbreviated amounts before converting to minor units: USD 120k is 12000000 cents; EUR 90,000 is 9000000 cents; JPY 10m is 10000000 yen because JPY has no fractional minor unit.
- For a range, store its lower and upper bounds. For one exact amount, use that amount for both bounds. Use null for an unstated bound.
- kind must be base_salary, total_compensation, bonus, equity, or other. period must be hour, day, week, month, year, one_time, or unknown.
- rawText preserves the compensation wording and source must be exactly job-posting.
- If a currency cannot be identified confidently, preserve the wording in submissionDetails.salary but do not invent a compensation item.`

const analysisContributionKey = workflowKey<
  CampaignAnalysisPromptContribution<ApplicationRegistryAnalysis>
>('application-registry.analysis.contribution')

const recommendationContributionKey = workflowKey<
  CampaignRecommendationPromptContribution<
    Schema.Schema.Type<typeof FitAssessmentSchema>
  >
>('application-registry.recommendation.contribution')

export const applicationRegistryAnalysisResultKey =
  workflowKey<ApplicationRegistryAnalysis>('application-registry.analysis')

export const applicationRegistryFitAssessmentResultKey = workflowKey<
  Schema.Schema.Type<typeof FitAssessmentSchema>
>('application-registry.fit-assessment')

export const isValidApplicationRegistryFitAssessment = (
  assessment: Schema.Schema.Type<typeof FitAssessmentSchema>
) =>
  Object.values(assessment.dimensions).reduce(
    (total, score) => total + score,
    0
  ) === assessment.score

export const applicationRegistryAnalysisContribution =
  defineCampaignAnalysisContribution({
    key: analysisContributionKey,
    name: applicationRegistryCampaignPluginId,
    resultKey: applicationRegistryAnalysisResultKey,
    stepId: 'application-registry.analysis',
  })

export const applicationRegistryRecommendationContribution =
  defineCampaignRecommendationContribution({
    key: recommendationContributionKey,
    name: applicationRegistryCampaignPluginId,
    resultKey: applicationRegistryFitAssessmentResultKey,
    stepId: 'application-registry.analysis',
  })

const applicationRegistryRecommendationInstructions = `Assess the selected profile's fit for this opportunity using application-fit-v1.

Return an integer score from 0 to 100 and the evidence behind it. Score only claims supported by the supplied CV source and posting. Unknown information is a gap, not proof of failure.

The five dimension values must use these maxima and their sum must equal score:
- hardRequirements: 0-40 for explicit must-have qualifications.
- coreExperience: 0-25 for directly relevant technical and professional experience.
- seniorityAndScope: 0-15 for ownership, leadership, and expected scope.
- practicalEligibility: 0-10 for explicit location, language, work authorization, and work-mode feasibility.
- preferredSignals: 0-10 for stated nice-to-have qualifications and differentiators.

Use hardBlockers only for an explicit contradiction with a mandatory requirement, not for information the posting or CV leaves unknown. strengths and gaps must be short evidence-grounded strings. rationale must explain the score without referring to prompts, profiles being selected, or supplied context. rubricVersion must be exactly application-fit-v1.`

export const makeApplicationRegistryAnalysisStep = (
  failurePolicy: WorkflowFailurePolicy
): WorkflowStep => ({
  dependsOn: [
    applicationRegistryConflictStepId,
    campaignWorkflowStepIds.target.fetchJob,
  ],
  execute: () =>
    Effect.succeed([
      workflowOutput(analysisContributionKey, {
        instructions: applicationRegistryAnalysisInstructions,
        schema: ApplicationRegistryAnalysisSchema,
      }),
      workflowOutput(recommendationContributionKey, {
        instructions: applicationRegistryRecommendationInstructions,
        schema: FitAssessmentSchema,
      }),
    ]),
  failurePolicy,
  id: applicationRegistryAnalysisContribution.stepId,
  label: 'Extract application registry metadata',
  scope: 'target',
})
