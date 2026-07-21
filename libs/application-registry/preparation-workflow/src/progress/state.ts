import type {
  PreparationRunState,
  PreparationStage,
  PreparationStepHistoryEntry,
  PreparationWorkflowInput,
} from '../domain'
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

const lastStepEntry = (
  history: ReadonlyArray<PreparationStepHistoryEntry>
): PreparationStepHistoryEntry | undefined => history.at(-1)

const appendStepEntry = (
  history: ReadonlyArray<PreparationStepHistoryEntry>,
  entry: PreparationStepHistoryEntry
): ReadonlyArray<PreparationStepHistoryEntry> => [...history, entry]

const completeCurrentStep = (
  history: ReadonlyArray<PreparationStepHistoryEntry>,
  occurredAt: number,
  message?: string
): ReadonlyArray<PreparationStepHistoryEntry> => {
  const current = lastStepEntry(history)
  if (
    current === undefined ||
    current.status === 'completed' ||
    current.status === 'failed' ||
    current.status === 'cancelled'
  ) {
    return history
  }
  return appendStepEntry(history, {
    ...current,
    ...(message === undefined ? {} : { message }),
    occurredAt,
    status: 'completed',
  })
}

export const startPreparationHistory = (
  message: string,
  occurredAt: number
): ReadonlyArray<PreparationStepHistoryEntry> => [
  {
    message,
    occurredAt,
    stage: 'queued',
    status: 'running',
  },
]

export const advancePreparationStep = (
  history: ReadonlyArray<PreparationStepHistoryEntry>,
  stage: PreparationStage,
  message: string,
  occurredAt: number,
  status: 'running' | 'waiting' = 'running'
): ReadonlyArray<PreparationStepHistoryEntry> => {
  const current = lastStepEntry(history)
  const completed =
    current === undefined || current.stage === stage
      ? history
      : completeCurrentStep(history, occurredAt)
  return appendStepEntry(completed, {
    message,
    occurredAt,
    stage,
    status,
  })
}

export const finishPreparationStep = (
  history: ReadonlyArray<PreparationStepHistoryEntry>,
  stage: PreparationStage,
  message: string,
  occurredAt: number,
  status: 'failed' | 'cancelled'
): ReadonlyArray<PreparationStepHistoryEntry> =>
  appendStepEntry(history, {
    message,
    occurredAt,
    stage,
    status,
  })

export const completePreparationHistory = (
  history: ReadonlyArray<PreparationStepHistoryEntry>,
  message: string,
  occurredAt: number
): ReadonlyArray<PreparationStepHistoryEntry> =>
  appendStepEntry(completeCurrentStep(history, occurredAt, message), {
    message,
    occurredAt,
    stage: 'complete',
    status: 'completed',
  })
