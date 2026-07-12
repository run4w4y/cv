import type { CampaignPluginIssue } from '../plugins/types'
import type { CampaignIssue, CampaignTargetRoutine } from './routine'

export const formatCampaignError = (cause: unknown): string => {
  if (!(cause instanceof Error)) {
    return String(cause)
  }

  if (cause.cause === undefined) {
    return cause.message
  }

  const detail = formatCampaignError(cause.cause)

  return detail === cause.message
    ? cause.message
    : `${cause.message}: ${detail}`
}

const runtimeIssue = ({
  message,
  severity,
  step,
  targetRoutine,
}: {
  readonly message: string
  readonly severity: CampaignIssue['severity']
  readonly step: string
  readonly targetRoutine: CampaignTargetRoutine
}): CampaignIssue => ({
  message,
  severity,
  step,
  targetUrl: targetRoutine.target.url.href,
})

export const runtimeError = (
  input: Omit<Parameters<typeof runtimeIssue>[0], 'severity'>
) => runtimeIssue({ ...input, severity: 'error' })

export const pluginWarning = (
  issue: CampaignPluginIssue,
  targetUrl?: string
): CampaignIssue => ({
  message: issue.message,
  severity: 'warning',
  step: `plugin:${issue.pluginId}:${issue.stage}`,
  ...(targetUrl ? { targetUrl } : {}),
})

export const uniqueIssues = (issues: readonly CampaignIssue[]) => {
  const seen = new Set<string>()

  return issues.filter((issue) => {
    const key = [
      issue.severity,
      issue.step,
      issue.targetUrl ?? '',
      issue.message,
    ].join('\u0000')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}
