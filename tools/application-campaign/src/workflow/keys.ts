import type { CampaignJobAnalysis, CampaignRecommendation } from '../ai/schema'
import type { StructuredAiService } from '../ai/structured'
import type { CampaignArtifactManifest } from '../artifacts/write-campaign'
import type { PrepareCampaignOptions } from '../config/model'
import type { JobSource } from '../job'
import { workflowKey } from './graph/key'
import type { SharedCampaignInputs } from './profile-inputs'
import type {
  CampaignDecisions,
  GeneratedCampaign,
  PreparedCampaign,
  PreparedCampaignResult,
  PreparedCampaignRun,
} from './types'

export const campaignOptionsKey =
  workflowKey<PrepareCampaignOptions>('campaign.options')
export const campaignRunIdKey = workflowKey<string>('campaign.run-id')
export const campaignPdfAssetsReadyKey = workflowKey<true>(
  'campaign.pdf-assets-ready'
)
export const sharedCampaignInputsKey = workflowKey<SharedCampaignInputs>(
  'campaign.shared-inputs'
)
export const targetCampaignResultsKey = workflowKey<
  readonly PreparedCampaignResult[]
>('campaign.target-results')
export const preparedCampaignRunKey = workflowKey<PreparedCampaignRun>(
  'campaign.prepared-run'
)

export const targetJobKey = workflowKey<JobSource>('campaign.target.job')
export const campaignStructuredAiKey = workflowKey<StructuredAiService>(
  'campaign.structured-ai'
)
export const targetAnalysisKey = workflowKey<CampaignJobAnalysis>(
  'campaign.target.analysis'
)
export const targetRecommendationKey = workflowKey<CampaignRecommendation>(
  'campaign.target.recommendation'
)
export const targetDecisionsKey = workflowKey<CampaignDecisions>(
  'campaign.target.decisions'
)
export const targetGeneratedKey = workflowKey<GeneratedCampaign>(
  'campaign.target.generated'
)
export const targetPrivateLinkKey = workflowKey<
  NonNullable<GeneratedCampaign['link']>
>('campaign.target.private-link')
export const targetPdfPathKey = workflowKey<string>('campaign.target.pdf-path')
export const targetDraftKey = workflowKey<PreparedCampaign>(
  'campaign.target.draft'
)
export const targetPreparedCampaignKey = workflowKey<PreparedCampaign>(
  'campaign.target.prepared'
)
export const targetArtifactManifestKey = workflowKey<CampaignArtifactManifest>(
  'campaign.target.artifact-manifest'
)
