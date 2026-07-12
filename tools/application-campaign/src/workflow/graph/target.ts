import type { PrepareCampaignTarget } from '../../config/model'
import { targetWorkflowStepId } from '../step-ids'
import type { WorkflowStep } from './types'

export const instantiateTargetWorkflowStep = <R>(
  step: WorkflowStep<R>,
  target: PrepareCampaignTarget,
  runStepIds: ReadonlySet<string> = new Set()
): WorkflowStep<R> => ({
  ...step,
  dependsOn: (step.dependsOn ?? []).map((dependency) =>
    runStepIds.has(dependency)
      ? dependency
      : targetWorkflowStepId(target.index, dependency)
  ),
  id: targetWorkflowStepId(target.index, step.id),
})
