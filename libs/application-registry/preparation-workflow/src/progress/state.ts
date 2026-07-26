import type {
  ArtifactPreparationStage,
  DocumentKind,
  PreparationArtifactState,
  PreparationHistoryEntry,
  PreparationJobInput,
  PreparationJobState,
  PreparationJobStatus,
  PreparationNodeStatus,
  PreparationStage,
  SharedPreparationStage,
} from '../domain'
import type { PreparationJobStates } from './model'

export const openPreparationStatuses = new Set<PreparationJobStatus>([
  'queued',
  'running',
  'needs_review',
  'cancelling',
])

export const sameRequestedPreparationIdentity = (
  left: PreparationJobInput,
  right: PreparationJobInput
): boolean => {
  if (left.locale !== right.locale) return false
  if (
    left.target._tag === 'ExistingApplication' &&
    right.target._tag === 'ExistingApplication'
  ) {
    return left.target.applicationId === right.target.applicationId
  }
  return left.target.url === right.target.url
}

export const samePreparationIdentity = (
  input: PreparationJobInput,
  job: PreparationJobState
): boolean => {
  if (input.locale !== job.locale) return false
  if (
    input.target._tag === 'ExistingApplication' &&
    job.applicationId !== null
  ) {
    return input.target.applicationId === job.applicationId
  }
  return input.target.url === job.url
}

export const updatePreparationJob = (
  jobs: PreparationJobStates,
  jobId: string,
  update: (job: PreparationJobState) => PreparationJobState
): PreparationJobStates => {
  const job = jobs.get(jobId)
  if (job === undefined) return jobs
  const updated = update(job)
  if (updated === job) return jobs
  const next = new Map(jobs)
  next.set(jobId, updated)
  return next
}

export const artifactForKind = (
  job: PreparationJobState,
  kind: DocumentKind
): PreparationArtifactState | null =>
  kind === 'cv' ? job.artifacts.cv : job.artifacts.coverLetter

export const updateJobArtifact = (
  job: PreparationJobState,
  kind: DocumentKind,
  update: (artifact: PreparationArtifactState) => PreparationArtifactState
): PreparationJobState => {
  const artifact = artifactForKind(job, kind)
  if (artifact === null) return job
  const updated = update(artifact)
  if (updated === artifact) return job
  return {
    ...job,
    artifacts:
      kind === 'cv'
        ? { ...job.artifacts, cv: updated }
        : { ...job.artifacts, coverLetter: updated },
  }
}

const lastHistoryEntry = <Stage extends PreparationStage>(
  history: ReadonlyArray<PreparationHistoryEntry<Stage>>
): PreparationHistoryEntry<Stage> | undefined => history.at(-1)

const appendHistoryEntry = <Stage extends PreparationStage>(
  history: ReadonlyArray<PreparationHistoryEntry<Stage>>,
  entry: PreparationHistoryEntry<Stage>
): ReadonlyArray<PreparationHistoryEntry<Stage>> => [...history, entry]

export const completeCurrentStep = <Stage extends PreparationStage>(
  history: ReadonlyArray<PreparationHistoryEntry<Stage>>,
  occurredAt: number,
  message?: string
): ReadonlyArray<PreparationHistoryEntry<Stage>> => {
  const current = lastHistoryEntry(history)
  if (
    current === undefined ||
    current.status === 'completed' ||
    current.status === 'failed' ||
    current.status === 'blocked' ||
    current.status === 'cancelled'
  ) {
    return history
  }
  return appendHistoryEntry(history, {
    ...current,
    ...(message === undefined ? {} : { message }),
    occurredAt,
    status: 'completed',
  })
}

export const startSharedHistory = (
  message: string,
  occurredAt: number
): ReadonlyArray<PreparationHistoryEntry<SharedPreparationStage>> => [
  {
    message,
    occurredAt,
    stage: 'queued',
    status: 'running',
  },
]

export const advancePreparationStep = <Stage extends PreparationStage>(
  history: ReadonlyArray<PreparationHistoryEntry<Stage>>,
  stage: Stage,
  message: string,
  occurredAt: number,
  status: 'running' | 'waiting' = 'running'
): ReadonlyArray<PreparationHistoryEntry<Stage>> => {
  const current = lastHistoryEntry(history)
  const completed =
    current === undefined || current.stage === stage
      ? history
      : completeCurrentStep(history, occurredAt)
  return appendHistoryEntry(completed, {
    message,
    occurredAt,
    stage,
    status,
  })
}

export const finishPreparationStep = <Stage extends PreparationStage>(
  history: ReadonlyArray<PreparationHistoryEntry<Stage>>,
  stage: Stage,
  message: string,
  occurredAt: number,
  status: 'failed' | 'blocked' | 'cancelled'
): ReadonlyArray<PreparationHistoryEntry<Stage>> =>
  appendHistoryEntry(history, {
    message,
    occurredAt,
    stage,
    status,
  })

export const completeArtifactHistory = (
  history: ReadonlyArray<PreparationHistoryEntry<ArtifactPreparationStage>>,
  message: string,
  occurredAt: number
): ReadonlyArray<PreparationHistoryEntry<ArtifactPreparationStage>> =>
  appendHistoryEntry(completeCurrentStep(history, occurredAt, message), {
    message,
    occurredAt,
    stage: 'complete',
    status: 'completed',
  })

const artifactStatuses = (
  job: PreparationJobState
): ReadonlyArray<PreparationArtifactState['status']> =>
  [job.artifacts.cv, job.artifacts.coverLetter].flatMap((artifact) =>
    artifact === null ? [] : [artifact.status]
  )

export const derivePreparationJobStatus = (
  job: PreparationJobState
): PreparationJobStatus => {
  if (job.status === 'cancelling') return 'cancelling'
  if (job.shared.status === 'failed') return 'failed'
  if (job.shared.status === 'cancelled') return 'cancelled'

  const statuses = artifactStatuses(job)
  if (statuses.some((status) => status === 'awaiting_review')) {
    return 'needs_review'
  }
  if (
    statuses.some(
      (status) =>
        status === 'running' ||
        status === 'review_submitted' ||
        status === 'queued'
    )
  ) {
    return job.shared.stage === 'queued' ? 'queued' : 'running'
  }
  const successes = statuses.filter((status) => status === 'approved').length
  const failures = statuses.filter(
    (status) =>
      status === 'failed' || status === 'blocked' || status === 'cancelled'
  ).length
  if (failures === statuses.length) {
    return statuses.every((status) => status === 'cancelled')
      ? 'cancelled'
      : 'failed'
  }
  if (successes > 0 && failures > 0) return 'mixed'
  return 'completed'
}

export const withDerivedJobStatus = (
  job: PreparationJobState
): PreparationJobState => ({
  ...job,
  status: derivePreparationJobStatus(job),
})

export const cancelArtifact = (
  artifact: PreparationArtifactState,
  message: string,
  updatedAt: number
): PreparationArtifactState => {
  if (
    artifact.status === 'approved' ||
    artifact.status === 'failed' ||
    artifact.status === 'blocked' ||
    artifact.status === 'cancelled'
  ) {
    return artifact
  }
  return {
    ...artifact,
    error: null,
    history:
      artifact.stage === null
        ? artifact.history
        : finishPreparationStep(
            artifact.history,
            artifact.stage,
            message,
            updatedAt,
            'cancelled'
          ),
    message,
    reviewToken: null,
    status: 'cancelled',
    updatedAt,
  }
}

export const isTerminalNodeStatus = (status: PreparationNodeStatus): boolean =>
  status === 'completed' ||
  status === 'failed' ||
  status === 'blocked' ||
  status === 'cancelled'
