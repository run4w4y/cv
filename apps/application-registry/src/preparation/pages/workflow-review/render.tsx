import type { DocumentKind } from '@cv/application-preparation-workflow/domain'
import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { Navigate, useParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import { preparationJobAtom } from '@/preparation/workflow/atoms'
import { WorkflowNotFound } from '@/preparation/workflows/not-found'

const isDocumentKind = (value: string | undefined): value is DocumentKind =>
  value === 'cv' || value === 'cover_letter'

export const WorkflowReviewPage = () => {
  const { batchId = '', jobId = '', kind } = useParams()
  const jobResult = useAtomValue(preparationJobAtom(jobId))

  if (AsyncResult.isFailure(jobResult)) {
    return (
      <WorkflowNotFound
        title="Candidate review unavailable"
        description={
          asyncResultErrorMessage(
            jobResult,
            'The workflow candidate could not be loaded.'
          ) ?? 'The workflow candidate could not be loaded.'
        }
      />
    )
  }

  if (!AsyncResult.isSuccess(jobResult)) {
    return (
      <WorkflowNotFound
        title="Loading candidate review"
        description="Waiting for the workflow artifact and application binding."
      />
    )
  }

  const job = jobResult.value
  const requestedKind = isDocumentKind(kind) ? kind : null
  const run =
    requestedKind === null
      ? (job?.artifacts.find(
          (artifact) =>
            artifact.kind === 'cv' && artifact.status === 'awaiting_review'
        ) ??
        job?.artifacts.find(
          (artifact) => artifact.status === 'awaiting_review'
        ) ??
        null)
      : (job?.artifacts.find(
          (artifact) =>
            artifact.kind === requestedKind &&
            artifact.status === 'awaiting_review'
        ) ?? null)

  if (
    job === null ||
    job.batchId !== batchId ||
    job.applicationId === null ||
    run === null ||
    run.candidate === null
  ) {
    return (
      <WorkflowNotFound
        title="Candidate review unavailable"
        description="This artifact has not produced a saved candidate awaiting review in the current desktop session."
      />
    )
  }

  const page = run.kind === 'cv' ? 'prepare' : 'cover-letter'
  const search = new URLSearchParams({
    back: `/workflows/${encodeURIComponent(batchId)}/jobs/${encodeURIComponent(jobId)}`,
    focus: 'review',
    locale: run.locale,
    run: run.runId,
  })

  return (
    <Navigate
      replace
      to={`/applications/${encodeURIComponent(job.applicationId)}/${page}?${search.toString()}`}
    />
  )
}
