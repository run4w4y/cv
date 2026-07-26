import { Context, type Effect, type SubscriptionRef } from 'effect'
import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import type {
  ArtifactPreparationStage,
  ContentRevisionResult,
  DocumentKind,
  PreparationJobInput,
  PreparationJobState,
  PreparationWorkflowError,
  SavedCandidate,
  SharedPreparationStage,
} from '../domain'

export type PreparationJobStates = ReadonlyMap<string, PreparationJobState>

export type PreparationJobReservation = {
  readonly batchId: string
  readonly batchPosition: number
  readonly input: PreparationJobInput
  readonly retryOfJobId: string | null
}

export type CancellationClaim = {
  readonly mode: 'active' | 'suspended'
  readonly previous: PreparationJobState
}

export type ProgressService = {
  readonly blockArtifact: (
    jobId: string,
    kind: DocumentKind,
    message: string
  ) => Effect.Effect<void>
  readonly cancelJob: (jobId: string) => Effect.Effect<void>
  readonly approveArtifact: (
    jobId: string,
    kind: DocumentKind,
    completion: {
      readonly message: string
      readonly result: ContentRevisionResult
    }
  ) => Effect.Effect<void>
  readonly failArtifact: (
    jobId: string,
    kind: DocumentKind,
    message: string
  ) => Effect.Effect<void>
  readonly failJob: (jobId: string, message: string) => Effect.Effect<void>
  readonly identify: (
    jobId: string,
    identity: {
      readonly applicationId: string
      readonly company: string | null
      readonly role: string
    }
  ) => Effect.Effect<void>
  readonly jobs: SubscriptionRef.SubscriptionRef<PreparationJobStates>
  readonly releaseReservations: (
    jobIds: ReadonlyArray<string>
  ) => Effect.Effect<void>
  readonly reserve: (
    reservations: ReadonlyArray<PreparationJobReservation>
  ) => Effect.Effect<void, PreparationWorkflowError>
  readonly requestCancel: (
    jobId: string,
    executionId: string
  ) => Effect.Effect<CancellationClaim | null>
  readonly restoreCancellation: (
    jobId: string,
    executionId: string,
    claim: CancellationClaim
  ) => Effect.Effect<void>
  readonly restoreApproval: (
    jobId: string,
    kind: DocumentKind,
    token: DurableDeferred.Token
  ) => Effect.Effect<void>
  readonly approvalSubmitted: (
    jobId: string,
    kind: DocumentKind,
    token: DurableDeferred.Token
  ) => Effect.Effect<boolean>
  readonly reviewReady: (
    jobId: string,
    kind: DocumentKind,
    applicationId: string,
    candidate: SavedCandidate,
    token: DurableDeferred.Token
  ) => Effect.Effect<void>
  readonly setExecution: (
    jobId: string,
    executionId: string
  ) => Effect.Effect<void>
  readonly stageArtifact: (
    jobId: string,
    kind: DocumentKind,
    stage: ArtifactPreparationStage,
    message: string
  ) => Effect.Effect<void>
  readonly stageShared: (
    jobId: string,
    stage: SharedPreparationStage,
    message: string,
    applicationId?: string
  ) => Effect.Effect<void>
}

export class PreparationProgress extends Context.Service<
  PreparationProgress,
  ProgressService
>()('@cv/application-registry/PreparationProgress') {}
