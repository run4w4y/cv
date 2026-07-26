import {
  type DocumentKind,
  type PreparationArtifact,
  type PreparationJob,
  preparationActivityProjection,
} from '@cv/application-preparation-workflow/domain'
import { useAtom, useAtomValue } from '@effect/atom-react'
import { Exit } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { useNavigate, useParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  cancelAiWorkflowJobFamily,
  preparationJobAtom,
  retryAiWorkflowJobAtom,
} from '@/preparation/workflow/atoms'
import {
  type WorkflowArtifactScreenItem,
  type WorkflowArtifactSummary,
  WorkflowJobScreen,
} from '@/preparation/workflows/job-screen'
import { WorkflowNotFound } from '@/preparation/workflows/not-found'
import type {
  WorkflowArtifactListItem,
  WorkflowJobListItem,
} from '@/preparation/workflows/presentation'

const artifactItems = (
  job: PreparationJob
): ReadonlyArray<readonly [DocumentKind, PreparationArtifact]> => [
  ...(job.artifacts.cv === null ? [] : ([['cv', job.artifacts.cv]] as const)),
  ...(job.artifacts.coverLetter === null
    ? []
    : ([['cover_letter', job.artifacts.coverLetter]] as const)),
]

const toArtifactListItem = (
  kind: DocumentKind,
  artifact: PreparationArtifact
): WorkflowArtifactListItem => ({
  error: artifact.error,
  kind,
  message: artifact.message,
  stage: artifact.stage,
  status: artifact.status,
})

const toJobItem = (job: PreparationJob): WorkflowJobListItem => ({
  applicationId: job.applicationId,
  artifacts: artifactItems(job).map(([kind, artifact]) =>
    toArtifactListItem(kind, artifact)
  ),
  batchId: job.batchId,
  company: job.company,
  createdAt: job.createdAt,
  jobId: job.jobId,
  kinds: artifactItems(job).map(([kind]) => kind),
  locale: job.locale,
  message: job.message,
  position: job.batchPosition,
  role: job.role,
  status: job.status,
  updatedAt: job.updatedAt,
  url: job.url,
})

const artifactSummary = (
  artifact: PreparationArtifact
): WorkflowArtifactSummary | null => {
  if (artifact.candidate === null) return null
  return {
    codexCalls: artifact.candidate.candidate.metadata.length,
    revisionNumber: artifact.candidate.result.revision.revisionNumber,
    tokens: artifact.candidate.candidate.metadata.reduce(
      (total, item) => total + (item.usage.totalTokens ?? 0),
      0
    ),
  }
}

const toArtifactItem = (
  kind: DocumentKind,
  artifact: PreparationArtifact
): WorkflowArtifactScreenItem => ({
  artifact: toArtifactListItem(kind, artifact),
  summary: artifactSummary(artifact),
})

export const WorkflowJobPage = () => {
  const { batchId = '', jobId = '' } = useParams()
  const navigate = useNavigate()
  const jobResult = useAtomValue(preparationJobAtom(jobId))
  const [cancelResult, cancel] = useAtom(cancelAiWorkflowJobFamily(jobId), {
    mode: 'promiseExit',
  })
  const [retryResult, retry] = useAtom(retryAiWorkflowJobAtom, {
    mode: 'promiseExit',
  })

  if (AsyncResult.isFailure(jobResult)) {
    return (
      <WorkflowNotFound
        title="Workflow runtime unavailable"
        description={
          asyncResultErrorMessage(
            jobResult,
            'The AI workflow job could not be loaded.'
          ) ?? 'The AI workflow job could not be loaded.'
        }
      />
    )
  }

  if (!AsyncResult.isSuccess(jobResult)) {
    return (
      <WorkflowNotFound
        title="Loading workflow job"
        description="Waiting for the desktop workflow runtime."
      />
    )
  }

  const job = jobResult.value
  if (job === null || job.batchId !== batchId) {
    return (
      <WorkflowNotFound
        title="Workflow job not found"
        description="This job is not present in the requested AI workflow batch."
      />
    )
  }

  const cancelling = AsyncResult.isWaiting(cancelResult)
  const retrying = AsyncResult.isWaiting(retryResult)
  const cancelError =
    asyncResultErrorMessage(
      cancelResult,
      'The workflow could not be cancelled.'
    ) ?? null
  const retryError =
    asyncResultErrorMessage(
      retryResult,
      'A new workflow job could not be started.'
    ) ?? null

  return (
    <WorkflowJobScreen
      activity={preparationActivityProjection(job)}
      artifacts={artifactItems(job).map(([kind, artifact]) =>
        toArtifactItem(kind, artifact)
      )}
      cancelError={cancelError}
      cancelling={cancelling}
      job={toJobItem(job)}
      onCancel={() => {
        void cancel({ jobId })
      }}
      onRetry={() => {
        void retry(jobId).then((exit) => {
          if (Exit.isFailure(exit)) return
          navigate(
            `/ai-workflows/${encodeURIComponent(exit.value.batchId)}/jobs/${encodeURIComponent(exit.value.jobId)}`
          )
        })
      }}
      retryError={retryError}
      retrying={retrying}
    />
  )
}
