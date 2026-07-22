import {
  type PreparationBatch,
  type PreparationRun,
  summarizePreparationBatch,
} from '@cv/application-preparation-workflow/domain'
import { useAtom, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as React from 'react'
import { useParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  cancelPreparationAtom,
  preparationRunsAtom,
} from '@/preparation/workflow/atoms'
import { WorkflowBatchScreen } from '@/preparation/workflows/batch-screen'
import { WorkflowNotFound } from '@/preparation/workflows/not-found'
import type {
  WorkflowBatchListItem,
  WorkflowJobListItem,
} from '@/preparation/workflows/presentation'

const activeStatuses = new Set([
  'queued',
  'running',
  'review_submitted',
  'cancelling',
])

const toBatchItem = (batch: PreparationBatch): WorkflowBatchListItem => {
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

const toJobItem = (run: PreparationRun): WorkflowJobListItem => ({
  applicationId: run.applicationId,
  batchId: run.batchId,
  createdAt: run.createdAt,
  error: run.error,
  kind: run.kind,
  locale: run.locale,
  message: run.message,
  position: run.batchPosition,
  runId: run.runId,
  stage: run.stage,
  status: run.status,
  updatedAt: run.updatedAt,
  url: run.url,
})

export const WorkflowBatchPage = () => {
  const { batchId = '' } = useParams()
  const runsResult = useAtomValue(preparationRunsAtom)
  const [cancelResult, cancel] = useAtom(cancelPreparationAtom, {
    mode: 'promiseExit',
  })
  const [cancellingRunIds, setCancellingRunIds] = React.useState<
    ReadonlySet<string>
  >(new Set())
  const cancelError =
    asyncResultErrorMessage(
      cancelResult,
      'One or more workflows could not be cancelled.'
    ) ?? null

  if (AsyncResult.isFailure(runsResult)) {
    return (
      <WorkflowNotFound
        title="Workflow runtime unavailable"
        description={
          asyncResultErrorMessage(
            runsResult,
            'The in-memory workflow runtime could not be loaded.'
          ) ?? 'The in-memory workflow runtime could not be loaded.'
        }
      />
    )
  }

  if (!AsyncResult.isSuccess(runsResult)) {
    return (
      <WorkflowNotFound
        title="Loading workflow batch"
        description="Waiting for the in-memory workflow runtime."
      />
    )
  }

  const batch = summarizePreparationBatch(batchId, [
    ...runsResult.value.values(),
  ])
  if (batch === null) {
    return (
      <WorkflowNotFound
        title="Workflow batch not found"
        description="This batch is not present in the current desktop session. It may have been cleared by an app restart."
      />
    )
  }

  const requestCancellation = async (runIds: ReadonlyArray<string>) => {
    setCancellingRunIds((current) => new Set([...current, ...runIds]))
    await Promise.allSettled(runIds.map((runId) => cancel({ runId })))
    setCancellingRunIds((current) => {
      const next = new Set(current)
      for (const runId of runIds) next.delete(runId)
      return next
    })
  }

  const cancellableIds = batch.runs
    .filter(
      (run) =>
        run.status === 'queued' ||
        run.status === 'running' ||
        run.status === 'review_submitted' ||
        run.status === 'awaiting_review'
    )
    .map((run) => run.runId)

  return (
    <WorkflowBatchScreen
      batch={toBatchItem(batch)}
      cancelError={cancelError}
      cancellingRunIds={cancellingRunIds}
      jobs={batch.runs.map(toJobItem)}
      onCancelAll={() => void requestCancellation(cancellableIds)}
      onCancelJob={(runId) => void requestCancellation([runId])}
    />
  )
}
