import {
  type PreparationJob,
  type PreparationRun,
  type PreparationStepSummary,
  preparationStepTimeline,
} from '@cv/application-preparation-workflow/domain'
import { useAtom, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { useParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  cancelPreparationAtom,
  preparationJobAtom,
} from '@/preparation/workflow/atoms'
import {
  type WorkflowArtifactScreenItem,
  type WorkflowArtifactSummary,
  WorkflowJobScreen,
} from '@/preparation/workflows/job-screen'
import { WorkflowNotFound } from '@/preparation/workflows/not-found'
import {
  type WorkflowJobListItem,
  type WorkflowStepListItem,
  workflowStageLabel,
} from '@/preparation/workflows/presentation'

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

const toStepItem = (step: PreparationStepSummary): WorkflowStepListItem => ({
  completedAt: step.completedAt,
  description:
    step.message ??
    (step.status === 'pending'
      ? 'Waiting for the preceding step.'
      : workflowStageLabel(step.stage)),
  stage: step.stage,
  startedAt: step.startedAt,
  status: step.status,
  title: workflowStageLabel(step.stage),
})

const artifactSummary = (
  run: PreparationRun
): WorkflowArtifactSummary | null => {
  if (run.candidate === null) return null
  return {
    codexCalls: run.candidate.candidate.metadata.length,
    revisionNumber: run.candidate.result.revision.revisionNumber,
    tokens: run.candidate.candidate.metadata.reduce(
      (total, item) => total + (item.usage.totalTokens ?? 0),
      0
    ),
  }
}

const toArtifactItem = (run: PreparationRun): WorkflowArtifactScreenItem => ({
  artifact: {
    error: run.error,
    kind: run.kind,
    message: run.message,
    runId: run.runId,
    stage: run.stage,
    status: run.status,
  },
  steps: preparationStepTimeline(run).map(toStepItem),
  summary: artifactSummary(run),
})

export const WorkflowJobPage = () => {
  const { batchId = '', jobId = '' } = useParams()
  const jobResult = useAtomValue(preparationJobAtom(jobId))
  const [cancelResult, cancel] = useAtom(cancelPreparationAtom, {
    mode: 'promiseExit',
  })

  if (AsyncResult.isFailure(jobResult)) {
    return (
      <WorkflowNotFound
        title="Workflow runtime unavailable"
        description={
          asyncResultErrorMessage(
            jobResult,
            'The workflow job could not be loaded.'
          ) ?? 'The workflow job could not be loaded.'
        }
      />
    )
  }

  if (!AsyncResult.isSuccess(jobResult)) {
    return (
      <WorkflowNotFound
        title="Loading workflow job"
        description="Waiting for the in-memory workflow runtime."
      />
    )
  }

  const job = jobResult.value
  if (job === null || job.batchId !== batchId) {
    return (
      <WorkflowNotFound
        title="Workflow job not found"
        description="This job is not present in the requested batch for the current desktop session."
      />
    )
  }

  const cancelling = AsyncResult.isWaiting(cancelResult)
  const cancelError =
    asyncResultErrorMessage(
      cancelResult,
      'The workflow could not be cancelled.'
    ) ?? null

  return (
    <WorkflowJobScreen
      artifacts={job.artifacts.map(toArtifactItem)}
      cancelError={cancelError}
      cancelling={cancelling}
      job={toJobItem(job)}
      onCancel={() => {
        void cancel({ runId: job.primaryRunId })
      }}
    />
  )
}
