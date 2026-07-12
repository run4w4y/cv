import type { WorkflowExecutionIssue, WorkflowOutputs } from '../graph'
import { pluginWarning, runtimeError, uniqueIssues } from '../issues'
import { targetPdfPathKey, targetPrivateLinkKey } from '../keys'
import type { CampaignTargetRoutine } from '../routine'
import type { FailedCampaign, GeneratedCampaign } from '../types'

export const targetWorkflowIssue = (
  issue: WorkflowExecutionIssue,
  targetRoutine: CampaignTargetRoutine
) =>
  issue.owner
    ? pluginWarning(
        {
          message: issue.message,
          pluginId: issue.owner,
          stage: issue.stepId,
        },
        targetRoutine.target.url.href
      )
    : runtimeError({
        message: issue.message,
        step: issue.stepId,
        targetRoutine,
      })

export const generatedFromOutputs = (
  outputs: WorkflowOutputs
): GeneratedCampaign => {
  const link = outputs.getOption(targetPrivateLinkKey)
  const pdfPath = outputs.getOption(targetPdfPathKey)

  return {
    ...(link._tag === 'Some' ? { link: link.value } : {}),
    ...(pdfPath._tag === 'Some' ? { pdfPath: pdfPath.value } : {}),
  }
}

export const failedCampaign = ({
  cause,
  failedStepId,
  issues,
  outputs,
  runId,
  targetRoutine,
}: {
  readonly cause: unknown
  readonly failedStepId: string
  readonly issues: readonly WorkflowExecutionIssue[]
  readonly outputs: WorkflowOutputs
  readonly runId: string
  readonly targetRoutine: CampaignTargetRoutine
}): FailedCampaign => ({
  error: cause instanceof Error ? cause.message : String(cause),
  generated: generatedFromOutputs(outputs),
  issues: uniqueIssues([
    ...targetRoutine.issues,
    ...issues.map((issue) => targetWorkflowIssue(issue, targetRoutine)),
    runtimeError({
      message: `Campaign target failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      step: failedStepId,
      targetRoutine,
    }),
  ]),
  outDir: targetRoutine.target.outDir,
  runId,
  status: 'failed',
  target: targetRoutine.target,
})
