import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'

import type { SavedCandidate } from './candidate'
import type {
  AiWorkflowTarget,
  DocumentKind,
  PreparationJobInput,
} from './input'

export const sharedPreparationStages = [
  'queued',
  'application',
  'capture',
  'analysis',
  'evidence',
] as const

export const artifactPreparationStages = [
  'planning',
  'composition',
  'validation',
  'saving',
  'review',
  'complete',
] as const

export const artifactPreparationStagesForKind = (
  kind: DocumentKind
): ReadonlyArray<ArtifactPreparationStage> =>
  kind === 'cv'
    ? artifactPreparationStages
    : artifactPreparationStages.filter((stage) => stage !== 'planning')

export const preparationStages = [
  ...sharedPreparationStages,
  ...artifactPreparationStages,
] as const

export type SharedPreparationStage = (typeof sharedPreparationStages)[number]
export type ArtifactPreparationStage =
  (typeof artifactPreparationStages)[number]
export type PreparationStage = (typeof preparationStages)[number]

export type PreparationNodeStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled'

export type PreparationHistoryEntry<Stage extends PreparationStage> = {
  readonly message: string
  readonly occurredAt: number
  readonly stage: Stage
  readonly status: Exclude<PreparationNodeStatus, 'pending'>
}

export type PreparationNodeSummary<Stage extends PreparationStage> = {
  readonly completedAt: number | null
  readonly message: string | null
  readonly stage: Stage
  readonly startedAt: number | null
  readonly status: PreparationNodeStatus
}

export type PreparationSharedTrack = {
  readonly history: ReadonlyArray<
    PreparationHistoryEntry<SharedPreparationStage>
  >
  readonly stage: SharedPreparationStage
  readonly status: 'running' | 'completed' | 'failed' | 'cancelled'
}

export type PreparationArtifactStatus =
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'review_submitted'
  | 'approved'
  | 'failed'
  | 'blocked'
  | 'cancelled'

export type PreparationArtifactState = {
  readonly candidate: SavedCandidate | null
  readonly error: string | null
  readonly history: ReadonlyArray<
    PreparationHistoryEntry<ArtifactPreparationStage>
  >
  readonly kind: DocumentKind
  readonly message: string
  readonly reviewToken: DurableDeferred.Token | null
  readonly stage: ArtifactPreparationStage | null
  readonly status: PreparationArtifactStatus
  readonly updatedAt: number
}

export type PreparationArtifact = Omit<PreparationArtifactState, 'reviewToken'>

export type PreparationArtifacts<State> = {
  readonly coverLetter: State | null
  readonly cv: State | null
}

export type PreparationJobStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'mixed'

/** Internal job state retains workflow engine and retry inputs. */
export type PreparationJobState = {
  readonly applicationId: string | null
  readonly artifacts: PreparationArtifacts<PreparationArtifactState>
  readonly batchId: string
  readonly batchPosition: number
  readonly company: string | null
  readonly createdAt: number
  readonly error: string | null
  readonly executionId: string | null
  readonly input: PreparationJobInput
  readonly jobId: string
  readonly locale: string
  readonly message: string
  readonly retryOfJobId: string | null
  readonly role: string | null
  readonly shared: PreparationSharedTrack
  readonly status: PreparationJobStatus
  readonly target: AiWorkflowTarget
  readonly updatedAt: number
  readonly url: string
}

export type PreparationJob = Omit<
  PreparationJobState,
  'artifacts' | 'executionId' | 'input'
> & {
  readonly artifacts: PreparationArtifacts<PreparationArtifact>
}

export const projectPreparationJob = (
  state: PreparationJobState
): PreparationJob => {
  const { artifacts, executionId: _executionId, input: _input, ...job } = state
  const projectArtifact = (
    artifact: PreparationArtifactState | null
  ): PreparationArtifact | null => {
    if (artifact === null) return null
    const { reviewToken: _reviewToken, ...projected } = artifact
    return projected
  }
  return {
    ...job,
    artifacts: {
      coverLetter: projectArtifact(artifacts.coverLetter),
      cv: projectArtifact(artifacts.cv),
    },
  }
}

export const projectPreparationJobs = (
  states: ReadonlyMap<string, PreparationJobState>
): ReadonlyMap<string, PreparationJob> =>
  new Map(
    [...states].map(([jobId, state]) => [jobId, projectPreparationJob(state)])
  )
