import type { PreparationRunState, PreparationWorkflowInput } from '../domain'
import { preparationSourceApplicationId, preparationSourceUrl } from '../domain'
import type { PreparationRunStates } from './model'

export const openPreparationStatuses = new Set<PreparationRunState['status']>([
  'queued',
  'running',
  'awaiting_review',
  'review_submitted',
  'cancelling',
])

export const samePreparationIdentity = (
  left: PreparationWorkflowInput,
  right: PreparationRunState
): boolean => {
  if (left.kind !== right.kind || left.locale !== right.locale) return false
  const applicationId = preparationSourceApplicationId(left.source)
  if (applicationId !== null && right.applicationId !== null) {
    return applicationId === right.applicationId
  }
  return preparationSourceUrl(left.source) === right.url
}

export const sameRequestedPreparationIdentity = (
  left: PreparationWorkflowInput,
  right: PreparationWorkflowInput
): boolean => {
  if (left.kind !== right.kind || left.locale !== right.locale) return false
  const leftApplicationId = preparationSourceApplicationId(left.source)
  const rightApplicationId = preparationSourceApplicationId(right.source)
  if (leftApplicationId !== null && rightApplicationId !== null) {
    return leftApplicationId === rightApplicationId
  }
  return (
    preparationSourceUrl(left.source) === preparationSourceUrl(right.source)
  )
}

export const updatePreparationRun = (
  runs: PreparationRunStates,
  runId: string,
  update: (run: PreparationRunState) => PreparationRunState
): PreparationRunStates => {
  const run = runs.get(runId)
  if (run === undefined) return runs
  const next = new Map(runs)
  next.set(runId, update(run))
  return next
}
