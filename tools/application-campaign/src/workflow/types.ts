import type { PrivateContentLinkResult } from '@cv/private-content-link'
import type { CampaignRecommendation } from '../ai/schema'
import type { JobSource } from '../job'
import type {
  CampaignIssue,
  CampaignRoutine,
  CampaignTargetRoutine,
} from './routine'

export type CampaignDecisions = {
  readonly audience: string
  readonly profile: string
}

export type GeneratedCampaign = {
  readonly link?: PrivateContentLinkResult
  readonly pdfPath?: string
}

export type PreparedCampaign = {
  readonly decisions: CampaignDecisions
  readonly extensions: Readonly<Record<string, unknown>>
  readonly generated: GeneratedCampaign
  readonly issues: readonly CampaignIssue[]
  readonly outDir: string
  readonly recommendation: CampaignRecommendation
  readonly runId: string
  readonly status: 'partial' | 'succeeded'
  readonly target: CampaignTargetRoutine['target']
}

export type FailedCampaign = {
  readonly error: string
  readonly generated: GeneratedCampaign
  readonly issues: readonly CampaignIssue[]
  readonly outDir: string
  readonly runId: string
  readonly status: 'failed'
  readonly target: CampaignTargetRoutine['target']
}

export type PreparedCampaignResult = PreparedCampaign | FailedCampaign

export type PreparedCampaignRun = {
  readonly campaigns: readonly PreparedCampaignResult[]
  readonly issues: readonly CampaignIssue[]
  readonly outDir: string
  readonly routine: CampaignRoutine
  readonly runId: string
  readonly status: 'failed' | 'partial' | 'succeeded'
}

export type CampaignDraft = PreparedCampaign & {
  readonly job: JobSource
  readonly routine: CampaignTargetRoutine
}

export type CampaignDraftResult = CampaignDraft | FailedCampaign
