import type { Schema } from 'effect'
import type {
  CampaignPlugin as WorkflowCampaignPlugin,
  WorkflowKey,
} from '../workflow/graph'

export type CampaignAnalysisPromptContribution<A = unknown> = {
  readonly instructions: string
  readonly schema: Schema.ConstraintDecoder<A, never>
}

const CampaignAnalysisContributionRegistrationTypeId = Symbol.for(
  '@cv/application-campaign/CampaignAnalysisContributionRegistration'
)

type CampaignAnalysisContributionRegistrationInput<A> = {
  readonly key: WorkflowKey<CampaignAnalysisPromptContribution<A>>
  readonly name: string
  readonly resultKey: WorkflowKey<NoInfer<A>>
  readonly stepId: string
}

export type CampaignAnalysisContributionRegistration = {
  readonly [CampaignAnalysisContributionRegistrationTypeId]: true
  readonly key: WorkflowKey<CampaignAnalysisPromptContribution<unknown>>
  readonly name: string
  readonly resultKey: WorkflowKey<unknown>
  readonly stepId: string
}

/** Couples the prompt schema type to the workflow key receiving its result. */
export const defineCampaignAnalysisContribution = <A>(
  registration: CampaignAnalysisContributionRegistrationInput<A>
): CampaignAnalysisContributionRegistration => ({
  [CampaignAnalysisContributionRegistrationTypeId]: true,
  ...registration,
})

/**
 * Plugins contribute executable graph steps. Contribution keys tell the core
 * analysis step which typed outputs should extend its single AI request.
 */
export type CampaignPlugin = WorkflowCampaignPlugin & {
  readonly analysisContributions?: readonly CampaignAnalysisContributionRegistration[]
}

export type CampaignJobAnalysisContribution = CampaignAnalysisPromptContribution

export type CampaignPluginIssue = {
  readonly message: string
  readonly pluginId: string
  readonly stage: string
}
