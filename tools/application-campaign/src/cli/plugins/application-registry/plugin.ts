import type { Context, Crypto } from 'effect'
import type { CampaignPlugin } from '../../../plugins/types'
import type { WorkflowFailurePolicy } from '../../../workflow/graph/types'
import {
  applicationRegistryAnalysisContribution,
  applicationRegistryCampaignPluginId,
  makeApplicationRegistryAnalysisStep,
} from './analysis'
import { makeRegistryCaptureStep } from './capture'
import type { ApplicationRegistryCampaignClient } from './client'
import { makeRegistrySyncStep } from './sync'

export type ApplicationRegistryCampaignPluginOptions = {
  readonly client: ApplicationRegistryCampaignClient
  readonly crypto: Context.Service.Shape<typeof Crypto.Crypto>
  readonly deviceId: string | null
  readonly failurePolicy?: WorkflowFailurePolicy
  readonly syncFailurePolicy?: Extract<
    WorkflowFailurePolicy,
    'fail-run' | 'warn'
  >
}

export const makeApplicationRegistryCampaignPlugin = ({
  client,
  crypto,
  deviceId,
  failurePolicy = 'warn',
  syncFailurePolicy = failurePolicy === 'fail-run' ? 'fail-run' : 'warn',
}: ApplicationRegistryCampaignPluginOptions): CampaignPlugin => ({
  analysisContributions: [applicationRegistryAnalysisContribution],
  id: applicationRegistryCampaignPluginId,
  steps: [
    makeRegistrySyncStep({ client, failurePolicy: syncFailurePolicy }),
    makeApplicationRegistryAnalysisStep(failurePolicy),
    makeRegistryCaptureStep({
      client,
      crypto,
      deviceId,
      failurePolicy,
    }),
  ],
  version: '2',
})
