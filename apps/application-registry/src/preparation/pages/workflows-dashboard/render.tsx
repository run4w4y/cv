import {
  type PreparationBatch,
  selectPreparationBatches,
} from '@cv/application-preparation-workflow/domain'
import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'

import { isDesktopHost } from '@/host/desktop'
import { asyncResultErrorMessage } from '@/lib/async-result'
import { preparationRunsAtom } from '@/preparation/workflow/atoms'
import { WorkflowDashboardScreen } from '@/preparation/workflows/dashboard-screen'
import { WorkflowDesktopUnavailable } from '@/preparation/workflows/desktop-unavailable'
import type { WorkflowBatchListItem } from '@/preparation/workflows/presentation'

const activeStatuses = new Set([
  'queued',
  'running',
  'review_submitted',
  'cancelling',
])

const toListItem = (batch: PreparationBatch): WorkflowBatchListItem => {
  const statuses = batch.runs.map((run) => run.status)
  const count = (status: string) =>
    statuses.filter((candidate) => candidate === status).length

  return {
    active: statuses.filter((status) => activeStatuses.has(status)).length,
    batchId: batch.batchId,
    cancelled: count('cancelled'),
    completed: count('approved') + count('rejected'),
    createdAt: batch.createdAt,
    failed: count('failed'),
    kind: batch.kind,
    locale: batch.locale,
    needsReview: count('awaiting_review'),
    status: batch.status,
    total: batch.runs.length,
    updatedAt: batch.updatedAt,
  }
}

export const WorkflowsDashboardPage = () => {
  const runsResult = useAtomValue(preparationRunsAtom)

  if (!isDesktopHost()) return <WorkflowDesktopUnavailable />

  if (AsyncResult.isFailure(runsResult)) {
    const error =
      asyncResultErrorMessage(
        runsResult,
        'The in-memory workflow runtime could not be created.'
      ) ?? 'The in-memory workflow runtime could not be created.'
    return <WorkflowDashboardScreen batches={[]} error={error} />
  }

  const batches = AsyncResult.isSuccess(runsResult)
    ? selectPreparationBatches(runsResult.value).map(toListItem)
    : []

  return (
    <WorkflowDashboardScreen
      batches={batches}
      loading={!AsyncResult.isSuccess(runsResult)}
    />
  )
}
