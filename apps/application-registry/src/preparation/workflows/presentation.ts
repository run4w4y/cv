import type {
  DocumentKind,
  PreparationRunStatus,
  PreparationStage,
} from '@cv/application-preparation-workflow/domain'

export type WorkflowBatchListItem = {
  readonly active: number
  readonly batchId: string
  readonly cancelled: number
  readonly completed: number
  readonly createdAt: number
  readonly failed: number
  readonly kind: DocumentKind
  readonly locale: string
  readonly needsReview: number
  readonly status: string
  readonly total: number
  readonly updatedAt: number
}

export type WorkflowJobListItem = {
  readonly applicationId: string | null
  readonly batchId: string
  readonly createdAt: number
  readonly error: string | null
  readonly kind: DocumentKind
  readonly locale: string
  readonly message: string
  readonly position: number
  readonly runId: string
  readonly stage: PreparationStage
  readonly status: PreparationRunStatus
  readonly updatedAt: number
  readonly url: string
}

export type WorkflowStepListItem = {
  readonly completedAt: number | null
  readonly description: string
  readonly stage: PreparationStage
  readonly startedAt: number | null
  readonly status:
    | 'pending'
    | 'running'
    | 'waiting'
    | 'completed'
    | 'failed'
    | 'cancelled'
  readonly title: string
}

export type WorkflowDashboardMetrics = {
  readonly active: number
  readonly completed: number
  readonly failed: number
  readonly needsReview: number
}

export const documentKindLabel = (kind: DocumentKind): string =>
  kind === 'cv' ? 'Tailored CV' : 'Cover letter'

export const workflowStatusLabel = (status: string): string => {
  const labels: Readonly<Record<string, string>> = {
    active: 'Running',
    approved: 'Approved',
    awaiting_review: 'Needs review',
    cancelled: 'Cancelled',
    cancelling: 'Cancelling',
    complete: 'Complete',
    completed: 'Complete',
    failed: 'Failed',
    mixed: 'Needs attention',
    needs_review: 'Needs review',
    queued: 'Queued',
    rejected: 'Rejected',
    review_submitted: 'Finishing review',
    running: 'Running',
  }
  return labels[status] ?? status.replaceAll('_', ' ')
}

export const workflowStageLabel = (stage: PreparationStage): string => {
  const labels: Readonly<Record<PreparationStage, string>> = {
    analysis: 'Analyze role',
    application: 'Create application',
    briefs: 'Plan document',
    capture: 'Capture job posting',
    complete: 'Complete',
    composition: 'Compose candidate',
    evidence: 'Select evidence',
    queued: 'Queued',
    review: 'Human review',
    saving: 'Save candidate',
    validation: 'Validate candidate',
  }
  return labels[stage]
}

export const workflowStatusTone = (
  status: string
): 'outline' | 'secondary' | 'success' | 'warning' | 'danger' => {
  if (status === 'failed' || status === 'rejected' || status === 'mixed') {
    return 'danger'
  }
  if (status === 'awaiting_review' || status === 'needs_review')
    return 'warning'
  if (
    status === 'approved' ||
    status === 'complete' ||
    status === 'completed'
  ) {
    return 'success'
  }
  if (
    status === 'running' ||
    status === 'active' ||
    status === 'review_submitted' ||
    status === 'cancelling'
  ) {
    return 'secondary'
  }
  return 'outline'
}

export const batchCompletionPercent = (batch: WorkflowBatchListItem): number =>
  batch.total === 0
    ? 0
    : Math.round(
        ((batch.completed + batch.failed + batch.cancelled) / batch.total) * 100
      )

export const formatWorkflowTime = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))

export const formatWorkflowDuration = (
  startedAt: number,
  endedAt: number
): string => {
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export const shortWorkflowId = (id: string): string =>
  id.length <= 12 ? id : id.slice(0, 8)

export const dashboardMetrics = (
  batches: ReadonlyArray<WorkflowBatchListItem>
): WorkflowDashboardMetrics =>
  batches.reduce(
    (metrics, batch) => ({
      active: metrics.active + batch.active,
      completed: metrics.completed + batch.completed,
      failed: metrics.failed + batch.failed,
      needsReview: metrics.needsReview + batch.needsReview,
    }),
    { active: 0, completed: 0, failed: 0, needsReview: 0 }
  )
