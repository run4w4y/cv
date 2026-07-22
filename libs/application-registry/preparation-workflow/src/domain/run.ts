import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'

import type { SavedCandidate } from './candidate'
import type { DocumentKind } from './input'

export const preparationStages = [
  'queued',
  'application',
  'capture',
  'analysis',
  'evidence',
  'briefs',
  'composition',
  'validation',
  'saving',
  'review',
  'complete',
] as const

export type PreparationStage = (typeof preparationStages)[number]

export type PreparationStepStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type PreparationStepHistoryEntry = {
  readonly message: string
  readonly occurredAt: number
  readonly stage: PreparationStage
  readonly status: Exclude<PreparationStepStatus, 'pending'>
}

export type PreparationStepSummary = {
  readonly completedAt: number | null
  readonly message: string | null
  readonly stage: PreparationStage
  readonly startedAt: number | null
  readonly status: PreparationStepStatus
}

type PreparationRunBase = {
  readonly applicationId: string | null
  readonly batchId: string
  readonly batchPosition: number
  readonly createdAt: number
  readonly kind: DocumentKind
  readonly locale: string
  readonly message: string
  readonly runId: string
  readonly stage: PreparationStage
  readonly stepHistory: ReadonlyArray<PreparationStepHistoryEntry>
  readonly updatedAt: number
  readonly url: string
}

/** Internal state includes the engine handles required for atomic commands. */
export type PreparationRunState = PreparationRunBase &
  (
    | {
        readonly candidate: null
        readonly error: null
        readonly executionId: string | null
        readonly reviewToken: null
        readonly stage: 'queued'
        readonly status: 'queued'
      }
    | {
        readonly candidate: null
        readonly error: null
        readonly executionId: string
        readonly reviewToken: null
        readonly status: 'running'
      }
    | {
        readonly candidate: SavedCandidate
        readonly error: null
        readonly executionId: string
        readonly reviewToken: DurableDeferred.Token
        readonly stage: 'review'
        readonly status: 'awaiting_review'
      }
    | {
        readonly candidate: SavedCandidate
        readonly error: null
        readonly executionId: string
        readonly reviewToken: null
        readonly stage: 'review'
        readonly status: 'review_submitted'
      }
    | {
        readonly candidate: SavedCandidate | null
        readonly error: null
        readonly executionId: string
        readonly reviewToken: DurableDeferred.Token | null
        readonly status: 'cancelling'
      }
    | {
        readonly candidate: SavedCandidate
        readonly error: null
        readonly executionId: string
        readonly reviewToken: null
        readonly stage: 'complete'
        readonly status: 'approved' | 'rejected'
      }
    | {
        readonly candidate: SavedCandidate | null
        readonly error: string
        readonly executionId: string | null
        readonly reviewToken: null
        readonly status: 'failed'
      }
    | {
        readonly candidate: SavedCandidate | null
        readonly error: null
        readonly executionId: string | null
        readonly reviewToken: null
        readonly status: 'cancelled'
      }
  )

type PublicRun<State> = State extends PreparationRunState
  ? Omit<State, 'executionId' | 'reviewToken'>
  : never

/** Stable UI projection: Workflow control handles never cross the package API. */
export type PreparationRun = PublicRun<PreparationRunState>

export type PreparationRunStatus = PreparationRun['status']

export const projectPreparationRun = (
  state: PreparationRunState
): PreparationRun => {
  const { executionId: _executionId, reviewToken: _reviewToken, ...run } = state
  return run
}

export const projectPreparationRuns = (
  states: ReadonlyMap<string, PreparationRunState>
): ReadonlyMap<string, PreparationRun> =>
  new Map(
    [...states].map(([runId, state]) => [runId, projectPreparationRun(state)])
  )
