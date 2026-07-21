import {
  type PreparationRun,
  type PreparationStepSummary,
  preparationStepTimeline,
} from '@cv/application-preparation-workflow/domain'
import { useAtom, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { useParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  cancelPreparationRunAtom,
  preparationRunAtom,
} from '@/preparation/workflow/atoms'
import {
  type WorkflowArtifactSummary,
  WorkflowJobScreen,
} from '@/preparation/workflows/job-screen'
import { WorkflowNotFound } from '@/preparation/workflows/not-found'
import {
  type WorkflowJobListItem,
  type WorkflowStepListItem,
  workflowStageLabel,
} from '@/preparation/workflows/presentation'

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

export const WorkflowJobPage = () => {
  const { batchId = '', runId = '' } = useParams()
  const runResult = useAtomValue(preparationRunAtom(runId))
  const [cancelResult, cancel] = useAtom(cancelPreparationRunAtom(runId), {
    mode: 'promiseExit',
  })

  if (AsyncResult.isFailure(runResult)) {
    return (
      <WorkflowNotFound
        title="Workflow runtime unavailable"
        description={
          asyncResultErrorMessage(
            runResult,
            'The workflow job could not be loaded.'
          ) ?? 'The workflow job could not be loaded.'
        }
      />
    )
  }

  if (!AsyncResult.isSuccess(runResult)) {
    return (
      <WorkflowNotFound
        title="Loading workflow job"
        description="Waiting for the in-memory workflow runtime."
      />
    )
  }

  const run = runResult.value
  if (run === null || run.batchId !== batchId) {
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
      artifact={artifactSummary(run)}
      cancelError={cancelError}
      cancelling={cancelling}
      job={toJobItem(run)}
      steps={preparationStepTimeline(run).map(toStepItem)}
      onCancel={() => {
        void cancel({ runId })
      }}
    />
  )
}
