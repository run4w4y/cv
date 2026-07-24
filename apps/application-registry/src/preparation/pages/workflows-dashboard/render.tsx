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

const activeStatuses = new Set(['queued', 'running'])

const toListItem = (batch: PreparationBatch): WorkflowBatchListItem => {
  const statuses = batch.jobs.map((job) => job.status)
  const count = (status: string) =>
    statuses.filter((candidate) => candidate === status).length

  return {
    active: statuses.filter((status) => activeStatuses.has(status)).length,
    batchId: batch.batchId,
    cancelled: count('cancelled'),
    completed: count('completed'),
    createdAt: batch.createdAt,
    failed: count('failed') + count('mixed'),
    kinds: batch.kinds,
    locale: batch.locale,
    needsReview: count('needs_review'),
    status: batch.status,
    total: batch.jobs.length,
    updatedAt: batch.updatedAt,
    urlCount: batch.urlCount,
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
