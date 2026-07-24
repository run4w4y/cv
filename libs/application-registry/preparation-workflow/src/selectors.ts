import {
  type PreparationRun,
  type PreparationRunStatus,
  type PreparationStepSummary,
  preparationStages,
} from './domain'

export type PreparationBatchStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'failed'
  | 'completed'
  | 'cancelled'

export type PreparationBatchStatusCounts = Readonly<
  Record<PreparationRunStatus, number>
>

export type PreparationJobStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'failed'
  | 'completed'
  | 'cancelled'
  | 'mixed'

export type PreparationJob = {
  readonly applicationId: string | null
  readonly artifacts: ReadonlyArray<PreparationRun>
  readonly batchId: string
  readonly batchPosition: number
  readonly company: string | null
  readonly createdAt: number
  readonly jobId: string
  readonly locale: string
  readonly message: string
  readonly primaryRunId: string
  readonly role: string | null
  readonly status: PreparationJobStatus
  readonly updatedAt: number
  readonly url: string
}

export type PreparationBatch = {
  readonly activeCount: number
  readonly batchId: string
  readonly createdAt: number
  readonly jobs: ReadonlyArray<PreparationJob>
  readonly kind: PreparationRun['kind']
  readonly kinds: ReadonlyArray<PreparationRun['kind']>
  readonly locale: string
  readonly needsReviewCount: number
  readonly runs: ReadonlyArray<PreparationRun>
  readonly status: PreparationBatchStatus
  readonly statusCounts: PreparationBatchStatusCounts
  readonly terminalCount: number
  readonly updatedAt: number
  readonly urlCount: number
}

const isTerminalStepStatus = (
  status: PreparationStepSummary['status']
): boolean =>
  status === 'completed' || status === 'failed' || status === 'cancelled'

export const preparationStepTimeline = (
  run: PreparationRun
): ReadonlyArray<PreparationStepSummary> =>
  preparationStages.map((stage) => {
    const entries = run.stepHistory.filter((entry) => entry.stage === stage)
    const first = entries[0]
    const latest = entries.at(-1)
    return {
      completedAt:
        latest !== undefined && isTerminalStepStatus(latest.status)
          ? latest.occurredAt
          : null,
      message: latest?.message ?? null,
      stage,
      startedAt: first?.occurredAt ?? null,
      status: latest?.status ?? 'pending',
    }
  })

const compareBatchRuns = (left: PreparationRun, right: PreparationRun) =>
  left.batchPosition - right.batchPosition ||
  left.createdAt - right.createdAt ||
  left.runId.localeCompare(right.runId)

const compareJobArtifacts = (left: PreparationRun, right: PreparationRun) =>
  (left.kind === 'cv' ? 0 : 1) - (right.kind === 'cv' ? 0 : 1) ||
  left.createdAt - right.createdAt ||
  left.runId.localeCompare(right.runId)

export const summarizePreparationJob = (
  jobId: string,
  runs: ReadonlyArray<PreparationRun>
): PreparationJob | null => {
  const artifacts = runs
    .filter((run) => run.jobId === jobId)
    .toSorted(compareJobArtifacts)
  const first = artifacts[0]
  if (first === undefined) return null
  const latest = artifacts.reduce((current, run) =>
    run.updatedAt > current.updatedAt ? run : current
  )
  const statuses = artifacts.map(({ status }) => status)
  const hasActive = statuses.some(
    (status) =>
      status === 'running' ||
      status === 'review_submitted' ||
      status === 'cancelling'
  )
  const hasQueued = statuses.some((status) => status === 'queued')
  const needsReview = statuses.some((status) => status === 'awaiting_review')
  const terminal = statuses.every(
    (status) =>
      status === 'approved' ||
      status === 'rejected' ||
      status === 'failed' ||
      status === 'cancelled'
  )
  const successful = statuses.some(
    (status) => status === 'approved' || status === 'rejected'
  )
  const failed = statuses.some((status) => status === 'failed')
  const cancelled = statuses.every((status) => status === 'cancelled')
  const status: PreparationJobStatus = hasActive
    ? 'running'
    : needsReview
      ? 'needs_review'
      : hasQueued
        ? 'queued'
        : cancelled
          ? 'cancelled'
          : terminal && failed && successful
            ? 'mixed'
            : failed
              ? 'failed'
              : 'completed'

  return {
    applicationId:
      artifacts.find(({ applicationId }) => applicationId !== null)
        ?.applicationId ?? null,
    artifacts,
    batchId: first.batchId,
    batchPosition: first.batchPosition,
    company: artifacts.find(({ company }) => company !== null)?.company ?? null,
    createdAt: Math.min(...artifacts.map(({ createdAt }) => createdAt)),
    jobId,
    locale: first.locale,
    message: latest.message,
    primaryRunId:
      artifacts.find(({ kind }) => kind === 'cv')?.runId ?? first.runId,
    role: artifacts.find(({ role }) => role !== null)?.role ?? null,
    status,
    updatedAt: Math.max(...artifacts.map(({ updatedAt }) => updatedAt)),
    url: first.url,
  }
}

export const groupPreparationRunsByJob = (
  runs: ReadonlyArray<PreparationRun>
): ReadonlyArray<PreparationJob> => {
  const grouped = new Map<string, Array<PreparationRun>>()
  for (const run of runs) {
    const job = grouped.get(run.jobId)
    if (job === undefined) grouped.set(run.jobId, [run])
    else job.push(run)
  }
  return [...grouped].flatMap(([jobId, artifacts]) => {
    const job = summarizePreparationJob(jobId, artifacts)
    return job === null ? [] : [job]
  })
}

export const selectPreparationJob = (
  runs: ReadonlyMap<string, PreparationRun>,
  jobId: string
): PreparationJob | null => summarizePreparationJob(jobId, [...runs.values()])

export const groupPreparationRunsByBatch = (
  runs: ReadonlyMap<string, PreparationRun>
): ReadonlyMap<string, ReadonlyArray<PreparationRun>> => {
  const grouped = new Map<string, Array<PreparationRun>>()
  for (const run of runs.values()) {
    const batch = grouped.get(run.batchId)
    if (batch === undefined) {
      grouped.set(run.batchId, [run])
    } else {
      batch.push(run)
    }
  }
  return new Map(
    [...grouped].map(([batchId, batchRuns]) => [
      batchId,
      batchRuns.toSorted(compareBatchRuns),
    ])
  )
}

const preparationBatchStatus = (
  jobs: ReadonlyArray<PreparationJob>
): PreparationBatchStatus => {
  if (jobs.every(({ status }) => status === 'queued')) return 'queued'
  if (jobs.some(({ status }) => status === 'needs_review')) {
    return 'needs_review'
  }
  if (jobs.some(({ status }) => status === 'queued' || status === 'running')) {
    return 'running'
  }
  if (jobs.some(({ status }) => status === 'failed' || status === 'mixed')) {
    return 'failed'
  }
  if (jobs.every(({ status }) => status === 'cancelled')) return 'cancelled'
  return 'completed'
}

export const summarizePreparationBatch = (
  batchId: string,
  runs: ReadonlyArray<PreparationRun>
): PreparationBatch | null => {
  const orderedRuns = runs
    .filter((run) => run.batchId === batchId)
    .toSorted(compareBatchRuns)
  const first = orderedRuns[0]
  if (first === undefined) return null
  const jobs = groupPreparationRunsByJob(orderedRuns).toSorted(
    (left, right) =>
      left.batchPosition - right.batchPosition ||
      left.createdAt - right.createdAt ||
      left.jobId.localeCompare(right.jobId)
  )
  const statusCounts = {
    approved: orderedRuns.filter((run) => run.status === 'approved').length,
    awaiting_review: orderedRuns.filter(
      (run) => run.status === 'awaiting_review'
    ).length,
    cancelled: orderedRuns.filter((run) => run.status === 'cancelled').length,
    cancelling: orderedRuns.filter((run) => run.status === 'cancelling').length,
    failed: orderedRuns.filter((run) => run.status === 'failed').length,
    queued: orderedRuns.filter((run) => run.status === 'queued').length,
    rejected: orderedRuns.filter((run) => run.status === 'rejected').length,
    review_submitted: orderedRuns.filter(
      (run) => run.status === 'review_submitted'
    ).length,
    running: orderedRuns.filter((run) => run.status === 'running').length,
  } satisfies PreparationBatchStatusCounts
  const activeCount = jobs.filter(
    ({ status }) => status === 'queued' || status === 'running'
  ).length
  const terminalCount = jobs.filter(({ status }) =>
    ['completed', 'failed', 'cancelled', 'mixed'].includes(status)
  ).length

  return {
    activeCount,
    batchId,
    createdAt: Math.min(...orderedRuns.map((run) => run.createdAt)),
    jobs,
    kind: first.kind,
    kinds: [...new Set(orderedRuns.map((run) => run.kind))],
    locale: first.locale,
    needsReviewCount: jobs.filter(({ status }) => status === 'needs_review')
      .length,
    runs: orderedRuns,
    status: preparationBatchStatus(jobs),
    statusCounts,
    terminalCount,
    updatedAt: Math.max(...orderedRuns.map((run) => run.updatedAt)),
    urlCount: jobs.length,
  }
}

export const selectPreparationBatches = (
  runs: ReadonlyMap<string, PreparationRun>
): ReadonlyArray<PreparationBatch> =>
  [...groupPreparationRunsByBatch(runs)]
    .flatMap(([batchId, batchRuns]) => {
      const batch = summarizePreparationBatch(batchId, batchRuns)
      return batch === null ? [] : [batch]
    })
    .toSorted(
      (left, right) =>
        right.createdAt - left.createdAt ||
        left.batchId.localeCompare(right.batchId)
    )

export const latestApplicationRun = (
  runs: ReadonlyMap<string, PreparationRun>,
  applicationId: string,
  kind: PreparationRun['kind'],
  locale: string
): PreparationRun | null => {
  let latest: PreparationRun | null = null
  for (const run of runs.values()) {
    if (
      run.applicationId === applicationId &&
      run.kind === kind &&
      run.locale === locale
    ) {
      latest = run
    }
  }
  return latest
}

export const latestOpenApplicationRun = (
  runs: ReadonlyMap<string, PreparationRun>,
  applicationId: string,
  kind: PreparationRun['kind'],
  locale: string
): PreparationRun | null => {
  let latest: PreparationRun | null = null
  for (const run of runs.values()) {
    if (
      run.applicationId === applicationId &&
      run.kind === kind &&
      run.locale === locale &&
      (run.status === 'queued' ||
        run.status === 'running' ||
        run.status === 'awaiting_review' ||
        run.status === 'review_submitted' ||
        run.status === 'cancelling')
    ) {
      latest = run
    }
  }
  return latest
}

export const applicationRunById = (
  runs: ReadonlyMap<string, PreparationRun>,
  runId: string,
  applicationId: string,
  kind: PreparationRun['kind'],
  locale: string
): PreparationRun | null => {
  const run = runs.get(runId)
  return run?.applicationId === applicationId &&
    run.kind === kind &&
    run.locale === locale
    ? run
    : null
}
