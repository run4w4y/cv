import { Clock, Effect, Layer, SubscriptionRef } from 'effect'
import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'

import type {
  ContentRevisionResult,
  PreparationStage,
  SavedCandidate,
} from '../domain'
import { PreparationWorkflowError } from '../domain'
import type {
  CancellationClaim,
  PreparationRunReservation,
  PreparationRunStates,
} from './model'
import { PreparationProgress } from './model'
import {
  releasePreparationReservations,
  reservePreparationRuns,
} from './reservations'
import {
  advancePreparationStep,
  completePreparationHistory,
  finishPreparationStep,
  updatePreparationRun,
} from './state'

export const preparationProgressLayer = Layer.effect(
  PreparationProgress,
  Effect.gen(function* () {
    const runs = yield* SubscriptionRef.make<PreparationRunStates>(new Map())

    const reserveEntries = Effect.fn('PreparationProgress.reserveEntries')(
      function* (reservations: ReadonlyArray<PreparationRunReservation>) {
        const createdAt = yield* Clock.currentTimeMillis
        const conflictMessage = yield* SubscriptionRef.modify(
          runs,
          (current) => {
            const reserved = reservePreparationRuns(
              current,
              reservations,
              createdAt
            )
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
      (reservation: PreparationRunReservation) => reserveEntries([reservation])
    )

    const reserve = Effect.fn('PreparationProgress.reserve')(
      (reservations: ReadonlyArray<PreparationRunReservation>) =>
        reserveEntries(reservations)
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
        const updatedAt = yield* Clock.currentTimeMillis
        yield* SubscriptionRef.update(runs, (current) =>
          updatePreparationRun(current, runId, (run) => ({
            ...run,
            executionId,
            updatedAt,
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
      const updatedAt = yield* Clock.currentTimeMillis
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
            stepHistory: advancePreparationStep(
              run.stepHistory,
              nextStage,
              message,
              updatedAt
            ),
            updatedAt,
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
      const updatedAt = yield* Clock.currentTimeMillis
      const message = 'Candidate saved. Human review is required.'
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
            message,
            reviewToken,
            stage: 'review',
            status: 'awaiting_review',
            stepHistory: advancePreparationStep(
              run.stepHistory,
              'review',
              message,
              updatedAt,
              'waiting'
            ),
            updatedAt,
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
      const updatedAt = yield* Clock.currentTimeMillis
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
                stepHistory: completePreparationHistory(
                  run.stepHistory,
                  completion.message,
                  updatedAt
                ),
                updatedAt,
              }
        )
      )
    })

    const reviewSubmitted = Effect.fn('PreparationProgress.reviewSubmitted')(
      function* (runId: string, token: DurableDeferred.Token) {
        const updatedAt = yield* Clock.currentTimeMillis
        const message = 'Human review decision submitted.'
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
            message,
            reviewToken: null,
            status: 'review_submitted',
            stepHistory: advancePreparationStep(
              run.stepHistory,
              'review',
              message,
              updatedAt
            ),
            updatedAt,
          })
          return [true, next] as const
        })
      }
    )

    const restoreReview = Effect.fn('PreparationProgress.restoreReview')(
      function* (runId: string, reviewToken: DurableDeferred.Token) {
        const updatedAt = yield* Clock.currentTimeMillis
        const message = 'Candidate saved. Human review is required.'
        yield* SubscriptionRef.update(runs, (current) =>
          updatePreparationRun(current, runId, (run) =>
            run.status !== 'review_submitted'
              ? run
              : {
                  ...run,
                  message,
                  reviewToken,
                  status: 'awaiting_review',
                  stepHistory: advancePreparationStep(
                    run.stepHistory,
                    'review',
                    message,
                    updatedAt,
                    'waiting'
                  ),
                  updatedAt,
                }
          )
        )
      }
    )

    const fail = Effect.fn('PreparationProgress.fail')(function* (
      runId: string,
      message: string
    ) {
      const updatedAt = yield* Clock.currentTimeMillis
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
                  stepHistory: finishPreparationStep(
                    run.stepHistory,
                    run.stage,
                    'Preparation cancelled for this browser session.',
                    updatedAt,
                    'cancelled'
                  ),
                  updatedAt,
                }
              : {
                  ...run,
                  error: message,
                  message: 'Preparation failed.',
                  reviewToken: null,
                  status: 'failed',
                  stepHistory: finishPreparationStep(
                    run.stepHistory,
                    run.stage,
                    message,
                    updatedAt,
                    'failed'
                  ),
                  updatedAt,
                }
        )
      )
    })

    const cancel = Effect.fn('PreparationProgress.cancel')(function* (
      runId: string
    ) {
      const updatedAt = yield* Clock.currentTimeMillis
      const message = 'Preparation cancelled for this browser session.'
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
                message,
                reviewToken: null,
                status: 'cancelled',
                stepHistory: finishPreparationStep(
                  run.stepHistory,
                  run.stage,
                  message,
                  updatedAt,
                  'cancelled'
                ),
                updatedAt,
              }
        )
      )
    })

    const requestCancel = Effect.fn('PreparationProgress.requestCancel')(
      function* (runId: string, executionId: string) {
        const updatedAt = yield* Clock.currentTimeMillis
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
            updatedAt,
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
      const updatedAt = yield* Clock.currentTimeMillis
      yield* SubscriptionRef.update(runs, (current) =>
        updatePreparationRun(current, runId, (run) =>
          run.status === 'cancelling' && run.executionId === executionId
            ? { ...claim.previous, updatedAt }
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
