import { Context, type Effect, type SubscriptionRef } from 'effect'
import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import type {
  ContentRevisionResult,
  PreparationRunState,
  PreparationStage,
  PreparationWorkflowError,
  PreparationWorkflowInput,
  SavedCandidate,
} from '../domain'

export type PreparationRunStates = ReadonlyMap<string, PreparationRunState>

export type PreparationRunReservation = {
  readonly batchId: string
  readonly batchPosition: number
  readonly input: PreparationWorkflowInput
}

export type CancellationClaim = {
  readonly mode: 'active' | 'suspended'
  readonly previous: PreparationRunState
}

export type ProgressService = {
  readonly cancel: (runId: string) => Effect.Effect<void>
  readonly complete: (
    runId: string,
    completion:
      | {
          readonly message: string
          readonly result: ContentRevisionResult
          readonly status: 'approved'
        }
      | {
          readonly message: string
          readonly status: 'rejected'
        }
  ) => Effect.Effect<void>
  readonly fail: (runId: string, message: string) => Effect.Effect<void>
  readonly register: (
    reservation: PreparationRunReservation
  ) => Effect.Effect<void, PreparationWorkflowError>
  readonly releaseReservations: (
    runIds: ReadonlyArray<string>
  ) => Effect.Effect<void>
  readonly reserve: (
    reservations: ReadonlyArray<PreparationRunReservation>
  ) => Effect.Effect<void, PreparationWorkflowError>
  readonly requestCancel: (
    runId: string,
    executionId: string
  ) => Effect.Effect<CancellationClaim | null>
  readonly restoreCancellation: (
    runId: string,
    executionId: string,
    claim: CancellationClaim
  ) => Effect.Effect<void>
  readonly restoreReview: (
    runId: string,
    token: DurableDeferred.Token
  ) => Effect.Effect<void>
  readonly reviewSubmitted: (
    runId: string,
    token: DurableDeferred.Token
  ) => Effect.Effect<boolean>
  readonly reviewReady: (
    runId: string,
    applicationId: string,
    candidate: SavedCandidate,
    token: DurableDeferred.Token
  ) => Effect.Effect<void>
  readonly runs: SubscriptionRef.SubscriptionRef<PreparationRunStates>
  readonly setExecution: (
    runId: string,
    executionId: string
  ) => Effect.Effect<void>
  readonly stage: (
    runId: string,
    stage: PreparationStage,
    message: string,
    applicationId?: string
  ) => Effect.Effect<void>
}

export class PreparationProgress extends Context.Service<
  PreparationProgress,
  ProgressService
>()('@cv/application-registry/PreparationProgress') {}
