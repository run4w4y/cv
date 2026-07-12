import type { Context } from 'effect'
import type { ApplicationAdvisor } from '../../ai/advisor'
import type { PrepareCampaignOptions } from '../../config/model'
import type { CampaignPluginsService } from '../../plugins/service'
import type { WorkflowOutputs } from '../graph'
import type { ProfileCatalog } from '../profile-inputs'
import type { CampaignTargetRoutine } from '../routine'

export type PrepareCampaignTargetInput = {
  readonly baseOutputs: WorkflowOutputs
  readonly candidateProfiles: readonly string[]
  readonly options: PrepareCampaignOptions
  readonly profileCatalog: ProfileCatalog
  readonly profileSummaries: string
  readonly runId: string
  readonly targetRoutine: CampaignTargetRoutine
}

export type TargetStepBuilderContext = PrepareCampaignTargetInput & {
  readonly advisor: Context.Service.Shape<typeof ApplicationAdvisor>
  readonly plugins: CampaignPluginsService
}
