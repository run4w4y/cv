import type {
  ArtifactPreparationStage,
  DocumentKind,
  PreparationArtifact,
  PreparationHistoryEntry,
  PreparationJob,
  PreparationJobStatus,
  PreparationNodeStatus,
  PreparationNodeSummary,
  PreparationStage,
  SharedPreparationStage,
} from './domain'
import {
  artifactPreparationStagesForKind,
  sharedPreparationStages,
} from './domain'

export type PreparationBatchStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'failed'
  | 'completed'
  | 'cancelled'

export type PreparationBatchStatusCounts = Readonly<
  Record<PreparationJobStatus, number>
>

export type PreparationBatch = {
  readonly activeCount: number
  readonly batchId: string
  readonly createdAt: number
  readonly jobs: ReadonlyArray<PreparationJob>
  readonly kinds: ReadonlyArray<DocumentKind>
  readonly locale: string
  readonly needsReviewCount: number
  readonly status: PreparationBatchStatus
  readonly statusCounts: PreparationBatchStatusCounts
  readonly terminalCount: number
  readonly updatedAt: number
  readonly targetCount: number
}

export type PreparationActivityScope = 'shared' | DocumentKind

export type PreparationActivityNode = {
  readonly completedAt: number | null
  readonly dependsOn: ReadonlyArray<string>
  readonly id: string
  readonly label: string
  readonly message: string | null
  readonly scope: PreparationActivityScope
  readonly stage: PreparationStage
  readonly startedAt: number | null
  readonly status: PreparationNodeStatus
}

export type PreparationActivityEvent = {
  readonly id: string
  readonly message: string
  readonly occurredAt: number
  readonly scope: PreparationActivityScope
  readonly stage: PreparationStage
  readonly status: Exclude<PreparationNodeStatus, 'pending'>
}

export type PreparationActivityProjection = {
  readonly events: ReadonlyArray<PreparationActivityEvent>
  readonly nodes: ReadonlyArray<PreparationActivityNode>
}

const stageLabels: Readonly<Record<PreparationStage, string>> = {
  analysis: 'Analyze role',
  application: 'Resolve application',
  capture: 'Capture context',
  complete: 'Complete',
  composition: 'Compose document',
  evidence: 'Plan evidence',
  planning: 'Plan composition',
  queued: 'Queued',
  review: 'Review',
  saving: 'Save draft',
  validation: 'Validate',
}

const isTerminalStepStatus = (status: PreparationNodeStatus): boolean =>
  status === 'completed' ||
  status === 'failed' ||
  status === 'blocked' ||
  status === 'cancelled'

export const preparationTrackTimeline = <Stage extends PreparationStage>(
  stages: ReadonlyArray<Stage>,
  history: ReadonlyArray<PreparationHistoryEntry<Stage>>
): ReadonlyArray<PreparationNodeSummary<Stage>> =>
  stages.map((stage) => {
    const entries = history.filter((entry) => entry.stage === stage)
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

const activityNodeId = (
  scope: PreparationActivityScope,
  stage: PreparationStage
): string => `${scope}:${stage}`

const nodeDependencies = (
  scope: PreparationActivityScope,
  stage: PreparationStage,
  hasCv: boolean
): ReadonlyArray<string> => {
  if (scope === 'shared') {
    const index = sharedPreparationStages.indexOf(
      stage as SharedPreparationStage
    )
    return index <= 0
      ? []
      : [
          activityNodeId(
            'shared',
            sharedPreparationStages[index - 1] as SharedPreparationStage
          ),
        ]
  }

  const artifactStages = artifactPreparationStagesForKind(scope)
  const index = artifactStages.indexOf(stage as ArtifactPreparationStage)
  if (index > 0) {
    return [
      activityNodeId(
        scope,
        artifactStages[index - 1] as ArtifactPreparationStage
      ),
    ]
  }
  if (scope === 'cover_letter' && hasCv) {
    return [activityNodeId('cv', 'review')]
  }
  return [activityNodeId('shared', 'evidence')]
}

const projectNodes = <Stage extends PreparationStage>(
  scope: PreparationActivityScope,
  stages: ReadonlyArray<Stage>,
  history: ReadonlyArray<PreparationHistoryEntry<Stage>>,
  hasCv: boolean
): ReadonlyArray<PreparationActivityNode> =>
  preparationTrackTimeline(stages, history).map((summary) => ({
    ...summary,
    dependsOn: nodeDependencies(scope, summary.stage, hasCv),
    id: activityNodeId(scope, summary.stage),
    label: stageLabels[summary.stage],
    scope,
  }))

const projectEvents = <Stage extends PreparationStage>(
  scope: PreparationActivityScope,
  history: ReadonlyArray<PreparationHistoryEntry<Stage>>
): ReadonlyArray<PreparationActivityEvent> =>
  history.map((entry, index) => ({
    ...entry,
    id: `${scope}:${entry.stage}:${entry.occurredAt}:${index}`,
    scope,
  }))

/**
 * Dependency-aware projection for the compact activity view: shared nodes are
 * emitted once, followed by independent artifact branches. The event stream
 * retains every state transition for diagnostics without duplicating shared
 * work into both documents.
 */
export const preparationActivityProjection = (
  job: PreparationJob
): PreparationActivityProjection => {
  const cv = job.artifacts.cv
  const coverLetter = job.artifacts.coverLetter
  const branches: ReadonlyArray<readonly [DocumentKind, PreparationArtifact]> =
    [
      ...(cv === null ? [] : ([['cv', cv]] as const)),
      ...(coverLetter === null
        ? []
        : ([['cover_letter', coverLetter]] as const)),
    ]
  return {
    events: [
      ...projectEvents('shared', job.shared.history),
      ...branches.flatMap(([scope, artifact]) =>
        projectEvents(scope, artifact.history)
      ),
    ].toSorted(
      (left, right) =>
        left.occurredAt - right.occurredAt || left.id.localeCompare(right.id)
    ),
    nodes: [
      ...projectNodes(
        'shared',
        sharedPreparationStages,
        job.shared.history,
        cv !== null
      ),
      ...branches.flatMap(([scope, artifact]) =>
        projectNodes(
          scope,
          artifactPreparationStagesForKind(scope),
          artifact.history,
          cv !== null
        )
      ),
    ],
  }
}

const compareBatchJobs = (left: PreparationJob, right: PreparationJob) =>
  left.batchPosition - right.batchPosition ||
  left.createdAt - right.createdAt ||
  left.jobId.localeCompare(right.jobId)

export const selectPreparationJob = (
  jobs: ReadonlyMap<string, PreparationJob>,
  jobId: string
): PreparationJob | null => jobs.get(jobId) ?? null

export const groupPreparationJobsByBatch = (
  jobs: ReadonlyMap<string, PreparationJob>
): ReadonlyMap<string, ReadonlyArray<PreparationJob>> => {
  const grouped = new Map<string, Array<PreparationJob>>()
  for (const job of jobs.values()) {
    const batch = grouped.get(job.batchId)
    if (batch === undefined) grouped.set(job.batchId, [job])
    else batch.push(job)
  }
  return new Map(
    [...grouped].map(([batchId, batchJobs]) => [
      batchId,
      batchJobs.toSorted(compareBatchJobs),
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
  if (
    jobs.some(
      ({ status }) =>
        status === 'queued' || status === 'running' || status === 'cancelling'
    )
  ) {
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
  jobs: ReadonlyArray<PreparationJob>
): PreparationBatch | null => {
  const orderedJobs = jobs
    .filter((job) => job.batchId === batchId)
    .toSorted(compareBatchJobs)
  const first = orderedJobs[0]
  if (first === undefined) return null
  const statusCounts = {
    cancelled: orderedJobs.filter((job) => job.status === 'cancelled').length,
    cancelling: orderedJobs.filter((job) => job.status === 'cancelling').length,
    completed: orderedJobs.filter((job) => job.status === 'completed').length,
    failed: orderedJobs.filter((job) => job.status === 'failed').length,
    mixed: orderedJobs.filter((job) => job.status === 'mixed').length,
    needs_review: orderedJobs.filter((job) => job.status === 'needs_review')
      .length,
    queued: orderedJobs.filter((job) => job.status === 'queued').length,
    running: orderedJobs.filter((job) => job.status === 'running').length,
  } satisfies PreparationBatchStatusCounts
  const kinds = new Set<DocumentKind>()
  for (const job of orderedJobs) {
    if (job.artifacts.cv !== null) kinds.add('cv')
    if (job.artifacts.coverLetter !== null) kinds.add('cover_letter')
  }
  return {
    activeCount: orderedJobs.filter(
      ({ status }) =>
        status === 'queued' || status === 'running' || status === 'cancelling'
    ).length,
    batchId,
    createdAt: Math.min(...orderedJobs.map((job) => job.createdAt)),
    jobs: orderedJobs,
    kinds: [...kinds],
    locale: first.locale,
    needsReviewCount: statusCounts.needs_review,
    status: preparationBatchStatus(orderedJobs),
    statusCounts,
    targetCount: orderedJobs.length,
    terminalCount: orderedJobs.filter(({ status }) =>
      ['completed', 'failed', 'cancelled', 'mixed'].includes(status)
    ).length,
    updatedAt: Math.max(...orderedJobs.map((job) => job.updatedAt)),
  }
}

export const selectPreparationBatches = (
  jobs: ReadonlyMap<string, PreparationJob>
): ReadonlyArray<PreparationBatch> =>
  [...groupPreparationJobsByBatch(jobs)]
    .flatMap(([batchId, batchJobs]) => {
      const batch = summarizePreparationBatch(batchId, batchJobs)
      return batch === null ? [] : [batch]
    })
    .toSorted(
      (left, right) =>
        right.createdAt - left.createdAt ||
        left.batchId.localeCompare(right.batchId)
    )

export const latestApplicationJob = (
  jobs: ReadonlyMap<string, PreparationJob>,
  applicationId: string,
  locale: string
): PreparationJob | null => {
  let latest: PreparationJob | null = null
  for (const job of jobs.values()) {
    if (
      job.applicationId === applicationId &&
      job.locale === locale &&
      (latest === null || job.createdAt >= latest.createdAt)
    ) {
      latest = job
    }
  }
  return latest
}

export const latestOpenApplicationJob = (
  jobs: ReadonlyMap<string, PreparationJob>,
  applicationId: string,
  locale: string
): PreparationJob | null => {
  let latest: PreparationJob | null = null
  for (const job of jobs.values()) {
    if (
      job.applicationId === applicationId &&
      job.locale === locale &&
      (job.status === 'queued' ||
        job.status === 'running' ||
        job.status === 'needs_review' ||
        job.status === 'cancelling') &&
      (latest === null || job.createdAt >= latest.createdAt)
    ) {
      latest = job
    }
  }
  return latest
}

export const applicationJobById = (
  jobs: ReadonlyMap<string, PreparationJob>,
  jobId: string,
  applicationId: string,
  locale: string
): PreparationJob | null => {
  const job = jobs.get(jobId)
  return job?.applicationId === applicationId && job.locale === locale
    ? job
    : null
}

export const selectPreparationArtifact = (
  job: PreparationJob,
  kind: DocumentKind
): PreparationArtifact | null =>
  kind === 'cv' ? job.artifacts.cv : job.artifacts.coverLetter
