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
  cancelAiWorkflowJobAtom,
  preparationJobsAtom,
} from '@/preparation/workflow/atoms'
import { WorkflowBatchScreen } from '@/preparation/workflows/batch-screen'
import { WorkflowNotFound } from '@/preparation/workflows/not-found'
import type {
  WorkflowBatchListItem,
  WorkflowJobListItem,
} from '@/preparation/workflows/presentation'

const activeStatuses = new Set(['queued', 'running', 'cancelling'])

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
    targetCount: batch.targetCount,
  }
}

const toJobItem = (job: PreparationJob): WorkflowJobListItem => {
  const artifacts = [job.artifacts.cv, job.artifacts.coverLetter].flatMap(
    (artifact) =>
      artifact === null
        ? []
        : [
            {
              error: artifact.error,
              kind: artifact.kind,
              message: artifact.message,
              stage: artifact.stage,
              status: artifact.status,
            },
          ]
  )
  return {
    applicationId: job.applicationId,
    artifacts,
    batchId: job.batchId,
    company: job.company,
    createdAt: job.createdAt,
    jobId: job.jobId,
    kinds: artifacts.map(({ kind }) => kind),
    locale: job.locale,
    message: job.message,
    position: job.batchPosition,
    role: job.role,
    status: job.status,
    updatedAt: job.updatedAt,
    url: job.url,
  }
}

export const WorkflowBatchPage = () => {
  const { batchId = '' } = useParams()
  const jobsResult = useAtomValue(preparationJobsAtom)
  const [cancelResult, cancel] = useAtom(cancelAiWorkflowJobAtom, {
    mode: 'promiseExit',
  })
  const [cancellingJobIds, setCancellingJobIds] = React.useState<
    ReadonlySet<string>
  >(new Set())
  const cancelError =
    asyncResultErrorMessage(
      cancelResult,
      'One or more workflows could not be cancelled.'
    ) ?? null

  if (AsyncResult.isFailure(jobsResult)) {
    return (
      <WorkflowNotFound
        title="Workflow runtime unavailable"
        description={
          asyncResultErrorMessage(
            jobsResult,
            'The in-memory workflow runtime could not be loaded.'
          ) ?? 'The in-memory workflow runtime could not be loaded.'
        }
      />
    )
  }

  if (!AsyncResult.isSuccess(jobsResult)) {
    return (
      <WorkflowNotFound
        title="Loading workflow batch"
        description="Waiting for the in-memory workflow runtime."
      />
    )
  }

  const batch = summarizePreparationBatch(batchId, [
    ...jobsResult.value.values(),
  ])
  if (batch === null) {
    return (
      <WorkflowNotFound
        title="Workflow batch not found"
        description="This batch is not present in the current desktop session. It may have been cleared by an app restart."
      />
    )
  }

  const requestCancellation = async (jobIds: ReadonlyArray<string>) => {
    setCancellingJobIds((current) => new Set([...current, ...jobIds]))
    await Promise.allSettled(jobIds.map((jobId) => cancel({ jobId })))
    setCancellingJobIds((current) => {
      const next = new Set(current)
      for (const jobId of jobIds) next.delete(jobId)
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
    .map((job) => job.jobId)

  return (
    <WorkflowBatchScreen
      batch={toBatchItem(batch)}
      cancelError={cancelError}
      cancellingJobIds={cancellingJobIds}
      jobs={batch.jobs.map(toJobItem)}
      onCancelAll={() => void requestCancellation(cancellableIds)}
      onCancelJob={(jobId) => void requestCancellation([jobId])}
    />
  )
}
