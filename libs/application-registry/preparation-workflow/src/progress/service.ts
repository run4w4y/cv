import { Effect, Layer, SubscriptionRef } from 'effect'
import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'

import type {
  ContentRevisionResult,
  PreparationStage,
  PreparationWorkflowInput,
  SavedCandidate,
} from '../domain'
import { PreparationWorkflowError } from '../domain'
import type { CancellationClaim, PreparationRunStates } from './model'
import { PreparationProgress } from './model'
import {
  releasePreparationReservations,
  reservePreparationRuns,
} from './reservations'
import { updatePreparationRun } from './state'

export const preparationProgressLayer = Layer.effect(
  PreparationProgress,
  Effect.gen(function* () {
    const runs = yield* SubscriptionRef.make<PreparationRunStates>(new Map())

    const reserveEntries = Effect.fn('PreparationProgress.reserveEntries')(
      function* (inputs: ReadonlyArray<PreparationWorkflowInput>) {
        const conflictMessage = yield* SubscriptionRef.modify(
          runs,
          (current) => {
            const reserved = reservePreparationRuns(current, inputs)
            return [reserved.conflict, reserved.runs] as const
          }
        )
        if (conflictMessage === null) return
        return yield* Effect.fail(
          new PreparationWorkflowError({
            message: conflictMessage,
            stage: 'queued',
          })
        )
      }
    )

    const register = Effect.fn('PreparationProgress.register')(
      (input: PreparationWorkflowInput) => reserveEntries([input])
    )

    const reserve = Effect.fn('PreparationProgress.reserve')(
      (inputs: ReadonlyArray<PreparationWorkflowInput>) =>
        reserveEntries(inputs)
    )

    const releaseReservations = Effect.fn(
      'PreparationProgress.releaseReservations'
    )(function* (runIds: ReadonlyArray<string>) {
      yield* SubscriptionRef.update(runs, (current) =>
        releasePreparationReservations(current, runIds)
      )
    })

    const setExecution = Effect.fn('PreparationProgress.setExecution')(
      function* (runId: string, executionId: string) {
        yield* SubscriptionRef.update(runs, (current) =>
          updatePreparationRun(current, runId, (run) => ({
            ...run,
            executionId,
          }))
        )
      }
    )

    const stage = Effect.fn('PreparationProgress.stage')(function* (
      runId: string,
      nextStage: PreparationStage,
      message: string,
      applicationId?: string
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePreparationRun(current, runId, (run) => {
          if (
            (run.status !== 'queued' && run.status !== 'running') ||
            run.executionId === null
          ) {
            return run
          }
          return {
            ...run,
            ...(applicationId === undefined ? {} : { applicationId }),
            candidate: null,
            error: null,
            executionId: run.executionId,
            message,
            reviewToken: null,
            stage: nextStage,
            status: 'running',
          }
        })
      )
    })

    const reviewReady = Effect.fn('PreparationProgress.reviewReady')(function* (
      runId: string,
      applicationId: string,
      candidate: SavedCandidate,
      reviewToken: DurableDeferred.Token
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePreparationRun(current, runId, (run) => {
          if (
            (run.status !== 'queued' && run.status !== 'running') ||
            run.executionId === null
          ) {
            return run
          }
          return {
            ...run,
            applicationId,
            candidate,
            error: null,
            executionId: run.executionId,
            message: 'Candidate saved. Human review is required.',
            reviewToken,
            stage: 'review',
            status: 'awaiting_review',
          }
        })
      )
    })

    const complete = Effect.fn('PreparationProgress.complete')(function* (
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
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePreparationRun(current, runId, (run) =>
          run.status !== 'awaiting_review' && run.status !== 'review_submitted'
            ? run
            : {
                ...run,
                candidate:
                  completion.status === 'approved'
                    ? { ...run.candidate, result: completion.result }
                    : run.candidate,
                message: completion.message,
                reviewToken: null,
                stage: 'complete',
                status: completion.status,
              }
        )
      )
    })

    const reviewSubmitted = Effect.fn('PreparationProgress.reviewSubmitted')(
      function* (runId: string, token: DurableDeferred.Token) {
        return yield* SubscriptionRef.modify(runs, (current) => {
          const run = current.get(runId)
          if (
            run === undefined ||
            run.status !== 'awaiting_review' ||
            run.reviewToken !== token
          ) {
            return [false, current] as const
          }
          const next = new Map(current)
          next.set(runId, {
            ...run,
            message: 'Human review decision submitted.',
            reviewToken: null,
            status: 'review_submitted',
          })
          return [true, next] as const
        })
      }
    )

    const restoreReview = Effect.fn('PreparationProgress.restoreReview')(
      function* (runId: string, reviewToken: DurableDeferred.Token) {
        yield* SubscriptionRef.update(runs, (current) =>
          updatePreparationRun(current, runId, (run) =>
            run.status !== 'review_submitted'
              ? run
              : {
                  ...run,
                  message: 'Candidate saved. Human review is required.',
                  reviewToken,
                  status: 'awaiting_review',
                }
          )
        )
      }
    )

    const fail = Effect.fn('PreparationProgress.fail')(function* (
      runId: string,
      message: string
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePreparationRun(current, runId, (run) =>
          run.status === 'approved' ||
          run.status === 'rejected' ||
          run.status === 'failed' ||
          run.status === 'cancelled'
            ? run
            : run.status === 'cancelling'
              ? {
                  ...run,
                  error: null,
                  message: 'Preparation cancelled for this browser session.',
                  reviewToken: null,
                  status: 'cancelled',
                }
              : {
                  ...run,
                  error: message,
                  message: 'Preparation failed.',
                  reviewToken: null,
                  status: 'failed',
                }
        )
      )
    })

    const cancel = Effect.fn('PreparationProgress.cancel')(function* (
      runId: string
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePreparationRun(current, runId, (run) =>
          run.status !== 'queued' &&
          run.status !== 'running' &&
          run.status !== 'awaiting_review' &&
          run.status !== 'cancelling'
            ? run
            : {
                ...run,
                error: null,
                message: 'Preparation cancelled for this browser session.',
                reviewToken: null,
                status: 'cancelled',
              }
        )
      )
    })

    const requestCancel = Effect.fn('PreparationProgress.requestCancel')(
      function* (runId: string, executionId: string) {
        return yield* SubscriptionRef.modify(runs, (current) => {
          const run = current.get(runId)
          if (
            run === undefined ||
            run.executionId !== executionId ||
            (run.status !== 'queued' &&
              run.status !== 'running' &&
              run.status !== 'awaiting_review')
          ) {
            return [null, current] as const
          }
          const next = new Map(current)
          next.set(runId, {
            ...run,
            error: null,
            executionId,
            message: 'Cancelling preparation for this browser session.',
            status: 'cancelling',
          })
          return [
            {
              mode:
                run.status === 'awaiting_review'
                  ? ('suspended' as const)
                  : ('active' as const),
              previous: run,
            },
            next,
          ] as const
        })
      }
    )

    const restoreCancellation = Effect.fn(
      'PreparationProgress.restoreCancellation'
    )(function* (runId: string, executionId: string, claim: CancellationClaim) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePreparationRun(current, runId, (run) =>
          run.status === 'cancelling' && run.executionId === executionId
            ? claim.previous
            : run
        )
      )
    })

    return PreparationProgress.of({
      cancel,
      complete,
      fail,
      register,
      releaseReservations,
      requestCancel,
      reserve,
      restoreCancellation,
      restoreReview,
      reviewSubmitted,
      reviewReady,
      runs,
      setExecution,
      stage,
    })
  })
)
