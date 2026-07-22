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

export type PreparationBatch = {
  readonly activeCount: number
  readonly batchId: string
  readonly createdAt: number
  readonly kind: PreparationRun['kind']
  readonly locale: string
  readonly needsReviewCount: number
  readonly runs: ReadonlyArray<PreparationRun>
  readonly status: PreparationBatchStatus
  readonly statusCounts: PreparationBatchStatusCounts
  readonly terminalCount: number
  readonly updatedAt: number
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
  counts: PreparationBatchStatusCounts,
  total: number
): PreparationBatchStatus => {
  if (counts.queued === total) return 'queued'
  if (counts.awaiting_review > 0) return 'needs_review'
  if (
    counts.queued +
      counts.running +
      counts.review_submitted +
      counts.cancelling >
    0
  ) {
    return 'running'
  }
  if (counts.failed > 0) return 'failed'
  if (counts.cancelled === total) return 'cancelled'
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
  const activeCount =
    statusCounts.queued +
    statusCounts.running +
    statusCounts.review_submitted +
    statusCounts.cancelling
  const terminalCount =
    statusCounts.approved +
    statusCounts.rejected +
    statusCounts.failed +
    statusCounts.cancelled

  return {
    activeCount,
    batchId,
    createdAt: Math.min(...orderedRuns.map((run) => run.createdAt)),
    kind: first.kind,
    locale: first.locale,
    needsReviewCount: statusCounts.awaiting_review,
    runs: orderedRuns,
    status: preparationBatchStatus(statusCounts, orderedRuns.length),
    statusCounts,
    terminalCount,
    updatedAt: Math.max(...orderedRuns.map((run) => run.updatedAt)),
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
