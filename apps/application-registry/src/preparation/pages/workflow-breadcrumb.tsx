import { summarizePreparationBatch } from '@cv/application-preparation-workflow/domain'
import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'

import {
  preparationJobAtom,
  preparationJobsAtom,
} from '@/preparation/workflow/atoms'
import {
  shortWorkflowId,
  workflowJobTitle,
} from '@/preparation/workflows/presentation'
import type { RegistryRouteHandle } from '@/shell/breadcrumbs'
import { useRegistryDocumentTitle } from '@/shell/breadcrumbs'

const WorkflowBatchBreadcrumbLabel = ({
  batchId,
}: {
  readonly batchId: string
}) => {
  const jobsResult = useAtomValue(preparationJobsAtom)
  const batch = AsyncResult.isSuccess(jobsResult)
    ? summarizePreparationBatch(batchId, [...jobsResult.value.values()])
    : null
  const label =
    batch?.jobs.length === 1 && batch.jobs[0] !== undefined
      ? workflowJobTitle({
          company: batch.jobs[0].company,
          role: batch.jobs[0].role,
          url: batch.jobs[0].url,
        })
      : batch === null
        ? `Batch ${shortWorkflowId(batchId)}`
        : `${batch.jobs.length} roles`
  useRegistryDocumentTitle(label)
  return label
}

const WorkflowJobBreadcrumbLabel = ({
  jobId,
  pageTitle,
}: {
  readonly jobId: string
  readonly pageTitle: string | null
}) => {
  const result = useAtomValue(preparationJobAtom(jobId))
  const job = AsyncResult.isSuccess(result) ? result.value : null
  const label =
    job === null
      ? `Job ${shortWorkflowId(jobId)}`
      : workflowJobTitle({
          company: job.company,
          role: job.role,
          url: job.url,
        })
  useRegistryDocumentTitle(
    pageTitle === null ? label : `${pageTitle} — ${label}`
  )
  return label
}

export const workflowBatchBreadcrumbHandle: RegistryRouteHandle = {
  managesDocumentTitle: true,
  breadcrumbs: (match) => {
    const batchId = match.params.batchId ?? ''
    return [
      { key: 'workflows', label: 'AI workflows', to: '/ai-workflows' },
      {
        key: 'batch',
        label: <WorkflowBatchBreadcrumbLabel batchId={batchId} />,
      },
    ]
  },
}

export const workflowJobBreadcrumbHandle = (
  page: null | {
    readonly key: string
    readonly label: string
  }
): RegistryRouteHandle => ({
  managesDocumentTitle: true,
  breadcrumbs: (match) => {
    const batchId = match.params.batchId ?? ''
    const jobId = match.params.jobId ?? ''
    return [
      { key: 'workflows', label: 'AI workflows', to: '/ai-workflows' },
      {
        key: 'batch',
        label: `Batch ${shortWorkflowId(batchId)}`,
        to: `/ai-workflows/${encodeURIComponent(batchId)}`,
      },
      {
        key: 'job',
        label: (
          <WorkflowJobBreadcrumbLabel
            jobId={jobId}
            pageTitle={page?.label ?? null}
          />
        ),
        ...(page === null
          ? {}
          : {
              to: `/ai-workflows/${encodeURIComponent(batchId)}/jobs/${encodeURIComponent(jobId)}`,
            }),
      },
      ...(page === null ? [] : [{ key: page.key, label: page.label }]),
    ]
  },
})
