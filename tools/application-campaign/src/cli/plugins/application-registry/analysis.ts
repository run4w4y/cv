import {
  ApplicationCompensationInputSchema,
  OpportunityDetailsSchema,
  SubmissionDetailsSchema,
} from '@cv/application-registry-entity'
import { Effect, Schema } from 'effect'
import {
  type CampaignAnalysisPromptContribution,
  defineCampaignAnalysisContribution,
} from '../../../plugins/types'
import { workflowKey, workflowOutput } from '../../../workflow/graph/key'
import type {
  WorkflowFailurePolicy,
  WorkflowStep,
} from '../../../workflow/graph/types'
import { campaignWorkflowStepIds } from '../../../workflow/step-ids'

export const applicationRegistryCampaignPluginId = 'application-registry'

export const ApplicationRegistryAnalysisSchema = Schema.Struct({
  compensations: Schema.Array(ApplicationCompensationInputSchema),
  details: OpportunityDetailsSchema,
  submissionDetails: SubmissionDetailsSchema,
})

export type ApplicationRegistryAnalysis = Schema.Schema.Type<
  typeof ApplicationRegistryAnalysisSchema
>

const applicationRegistryAnalysisInstructions = `Extract the registry metadata and operational details for this opportunity. Return one object with submissionDetails, details, and compensations.

- Use null for every unstated scalar field and [] for every unstated list. Do not infer requirements that the posting does not state.

For submissionDetails:
- applicationMethod and applicationUrl describe where/how to apply; contactEmail is the application or recruiter address when one is provided.
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

export const applicationRegistryAnalysisResultKey =
  workflowKey<ApplicationRegistryAnalysis>('application-registry.analysis')

export const applicationRegistryAnalysisContribution =
  defineCampaignAnalysisContribution({
    key: analysisContributionKey,
    name: applicationRegistryCampaignPluginId,
    resultKey: applicationRegistryAnalysisResultKey,
    stepId: 'application-registry.analysis',
  })

export const makeApplicationRegistryAnalysisStep = (
  failurePolicy: WorkflowFailurePolicy
): WorkflowStep => ({
  dependsOn: [campaignWorkflowStepIds.target.fetchJob],
  execute: () =>
    Effect.succeed([
      workflowOutput(analysisContributionKey, {
        instructions: applicationRegistryAnalysisInstructions,
        schema: ApplicationRegistryAnalysisSchema,
      }),
    ]),
  failurePolicy,
  id: applicationRegistryAnalysisContribution.stepId,
  label: 'Extract application registry metadata',
  scope: 'target',
})
