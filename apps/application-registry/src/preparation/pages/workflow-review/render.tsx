import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { Navigate, useParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import { preparationRunAtom } from '@/preparation/workflow/atoms'
import { WorkflowNotFound } from '@/preparation/workflows/not-found'

export const WorkflowReviewPage = () => {
  const { batchId = '', runId = '' } = useParams()
  const runResult = useAtomValue(preparationRunAtom(runId))

  if (AsyncResult.isFailure(runResult)) {
    return (
      <WorkflowNotFound
        title="Candidate review unavailable"
        description={
          asyncResultErrorMessage(
            runResult,
            'The workflow candidate could not be loaded.'
          ) ?? 'The workflow candidate could not be loaded.'
        }
      />
    )
  }

  if (!AsyncResult.isSuccess(runResult)) {
    return (
      <WorkflowNotFound
        title="Loading candidate review"
        description="Waiting for the workflow artifact and application binding."
      />
    )
  }

  const run = runResult.value
  if (
    run === null ||
    run.batchId !== batchId ||
    run.applicationId === null ||
    run.candidate === null
  ) {
    return (
      <WorkflowNotFound
        title="Candidate review unavailable"
        description="This job has not produced a saved candidate in the current desktop session."
      />
    )
  }

  const page = run.kind === 'cv' ? 'prepare' : 'cover-letter'
  const search = new URLSearchParams({
    back: `/workflows/${encodeURIComponent(batchId)}/jobs/${encodeURIComponent(runId)}`,
    focus: 'review',
    locale: run.locale,
    run: run.runId,
  })

  return (
    <Navigate
      replace
      to={`/applications/${encodeURIComponent(run.applicationId)}/${page}?${search.toString()}`}
    />
  )
}
