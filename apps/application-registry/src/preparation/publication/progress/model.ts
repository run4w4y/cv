import type { CvLink } from '@cv/application-registry-entity'
import { Context, type Effect, type SubscriptionRef } from 'effect'

import type {
  ActiveCvPublicationRun,
  CvPublicationRun,
  CvPublicationWorkflowError,
  CvPublicationWorkflowInput,
  CvPublicationWorkflowResult,
} from '../domain'

export type CvPublicationRuns = ReadonlyMap<string, CvPublicationRun>

export type CvPublicationCancellationClaim = {
  readonly previous: ActiveCvPublicationRun
}

export type CvPublicationProgressService = {
  readonly cancel: (runId: string) => Effect.Effect<void>
  readonly complete: (
    result: CvPublicationWorkflowResult
  ) => Effect.Effect<void>
  readonly fail: (
    runId: string,
    error: CvPublicationWorkflowError
  ) => Effect.Effect<void>
  readonly publishing: (runId: string) => Effect.Effect<void>
  readonly releaseReservation: (runId: string) => Effect.Effect<void>
  readonly requestCancel: (
    runId: string,
    executionId: string
  ) => Effect.Effect<CvPublicationCancellationClaim | null>
  readonly reserve: (
    input: CvPublicationWorkflowInput,
    executionId: string
  ) => Effect.Effect<void, CvPublicationWorkflowError>
  readonly restoreCancellation: (
    runId: string,
    executionId: string,
    claim: CvPublicationCancellationClaim
  ) => Effect.Effect<void>
  readonly runs: SubscriptionRef.SubscriptionRef<CvPublicationRuns>
  readonly startingPdf: (runId: string, link: CvLink) => Effect.Effect<void>
}

export class CvPublicationProgress extends Context.Service<
  CvPublicationProgress,
  CvPublicationProgressService
>()('@cv/application-registry/CvPublicationProgress') {}
