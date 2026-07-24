import {
  type PreparationBatch,
  type PreparationJob,
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

const activeStatuses = new Set(['queued', 'running'])

const toBatchItem = (batch: PreparationBatch): WorkflowBatchListItem => {
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

const toJobItem = (job: PreparationJob): WorkflowJobListItem => ({
  applicationId: job.applicationId,
  artifacts: job.artifacts.map((run) => ({
    error: run.error,
    kind: run.kind,
    message: run.message,
    runId: run.runId,
    stage: run.stage,
    status: run.status,
  })),
  batchId: job.batchId,
  company: job.company,
  createdAt: job.createdAt,
  jobId: job.jobId,
  kinds: job.artifacts.map(({ kind }) => kind),
  locale: job.locale,
  message: job.message,
  position: job.batchPosition,
  primaryRunId: job.primaryRunId,
  role: job.role,
  status: job.status,
  updatedAt: job.updatedAt,
  url: job.url,
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

  const cancellableIds = batch.jobs
    .filter(
      (job) =>
        job.status === 'queued' ||
        job.status === 'running' ||
        job.status === 'needs_review'
    )
    .map((job) => job.primaryRunId)

  return (
    <WorkflowBatchScreen
      batch={toBatchItem(batch)}
      cancelError={cancelError}
      cancellingRunIds={cancellingRunIds}
      jobs={batch.jobs.map(toJobItem)}
      onCancelAll={() => void requestCancellation(cancellableIds)}
      onCancelJob={(runId) => void requestCancellation([runId])}
    />
  )
}
