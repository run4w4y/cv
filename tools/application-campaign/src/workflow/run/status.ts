import type { PreparedCampaignResult, PreparedCampaignRun } from '../types'

export const campaignRunStatus = (
  statuses: readonly PreparedCampaignResult['status'][]
): PreparedCampaignRun['status'] => {
  if (statuses.every((status) => status === 'succeeded')) return 'succeeded'
  return statuses.every((status) => status === 'failed') ? 'failed' : 'partial'
}
