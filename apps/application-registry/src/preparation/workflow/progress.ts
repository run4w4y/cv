import type { ContentRevisionResultResponse } from '@cv/application-registry-api-contract'
import { Context, Effect, Layer, SubscriptionRef } from 'effect'
import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'

import type {
  PreparationRun,
  PreparationStage,
  PreparationWorkflowInput,
  SavedCandidate,
} from './domain'
import {
  PreparationWorkflowError,
  preparationSourceApplicationId,
  preparationSourceUrl,
} from './domain'

export type PreparationRuns = ReadonlyMap<string, PreparationRun>

export type CancellationClaim = {
  readonly mode: 'active' | 'suspended'
  readonly previous: PreparationRun
}

export type ProgressService = {
  readonly cancel: (runId: string) => Effect.Effect<void>
  readonly complete: (
    runId: string,
    completion:
      | {
          readonly message: string
          readonly result: ContentRevisionResultResponse
          readonly status: 'approved'
        }
      | {
          readonly message: string
          readonly status: 'rejected'
        }
  ) => Effect.Effect<void>
  readonly fail: (runId: string, message: string) => Effect.Effect<void>
  readonly register: (
    input: PreparationWorkflowInput
  ) => Effect.Effect<void, PreparationWorkflowError>
  readonly releaseReservations: (
    runIds: ReadonlyArray<string>
  ) => Effect.Effect<void>
  readonly reserve: (
    inputs: ReadonlyArray<PreparationWorkflowInput>
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
  readonly runs: SubscriptionRef.SubscriptionRef<PreparationRuns>
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

const openStatuses = new Set<PreparationRun['status']>([
  'queued',
  'running',
  'awaiting_review',
  'review_submitted',
  'cancelling',
])

const samePreparationIdentity = (
  left: PreparationWorkflowInput,
  right: PreparationRun
): boolean => {
  if (left.kind !== right.kind || left.locale !== right.locale) return false
  const applicationId = preparationSourceApplicationId(left.source)
  if (applicationId !== null && right.applicationId !== null) {
    return applicationId === right.applicationId
  }
  return preparationSourceUrl(left.source) === right.url
}

const sameRequestedIdentity = (
  left: PreparationWorkflowInput,
  right: PreparationWorkflowInput
): boolean => {
  if (left.kind !== right.kind || left.locale !== right.locale) return false
  const leftApplicationId = preparationSourceApplicationId(left.source)
  const rightApplicationId = preparationSourceApplicationId(right.source)
  if (leftApplicationId !== null && rightApplicationId !== null) {
    return leftApplicationId === rightApplicationId
  }
  return (
    preparationSourceUrl(left.source) === preparationSourceUrl(right.source)
  )
}

const updateRun = (
  runs: PreparationRuns,
  runId: string,
  update: (run: PreparationRun) => PreparationRun
): PreparationRuns => {
  const run = runs.get(runId)
  if (run === undefined) return runs
  const next = new Map(runs)
  next.set(runId, update(run))
  return next
}

export const preparationProgressLayer = Layer.effect(
  PreparationProgress,
  Effect.gen(function* () {
    const runs = yield* SubscriptionRef.make<PreparationRuns>(new Map())

    const reserveEntries = Effect.fn('PreparationProgress.reserveEntries')(
      function* (inputs: ReadonlyArray<PreparationWorkflowInput>) {
        const conflictMessage = yield* SubscriptionRef.modify(
          runs,
          (current) => {
            for (const [index, input] of inputs.entries()) {
              if (current.has(input.runId)) {
                return [
                  `Preparation run ${input.runId} already exists.`,
                  current,
                ] as const
              }

              const precedingInputs = inputs.slice(0, index)
              if (
                precedingInputs.some(
                  (requested) => requested.runId === input.runId
                )
              ) {
                return [
                  `Preparation run ${input.runId} is duplicated within this batch.`,
                  current,
                ] as const
              }

              const requestedConflict = precedingInputs.find((requested) =>
                sameRequestedIdentity(input, requested)
              )
              if (requestedConflict !== undefined) {
                return [
                  `Preparation run ${requestedConflict.runId} is duplicated within this batch.`,
                  current,
                ] as const
              }

              const existingConflict = [...current.values()].find(
                (run) =>
                  openStatuses.has(run.status) &&
                  samePreparationIdentity(input, run)
              )
              if (existingConflict !== undefined) {
                return [
                  `Preparation run ${existingConflict.runId} is already open for this application, document kind, and locale.`,
                  current,
                ] as const
              }
            }

            const next = new Map(current)
            for (const input of inputs) {
              next.set(input.runId, {
                applicationId: preparationSourceApplicationId(input.source),
                candidate: null,
                error: null,
                executionId: null,
                kind: input.kind,
                locale: input.locale,
                message: 'Waiting for a preparation slot.',
                reviewToken: null,
                runId: input.runId,
                stage: 'queued',
                status: 'queued',
                url: preparationSourceUrl(input.source),
              })
            }
            return [null, next] as const
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
      const requested = new Set(runIds)
      yield* SubscriptionRef.update(runs, (current) => {
        let next: Map<string, PreparationRun> | undefined
        for (const runId of requested) {
          const run = current.get(runId)
          if (
            run === undefined ||
            run.status !== 'queued' ||
            run.executionId !== null
          ) {
            continue
          }
          next ??= new Map(current)
          next.delete(runId)
        }
        return next ?? current
      })
    })

    const setExecution = Effect.fn('PreparationProgress.setExecution')(
      function* (runId: string, executionId: string) {
        yield* SubscriptionRef.update(runs, (current) =>
          updateRun(current, runId, (run) => ({ ...run, executionId }))
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
        updateRun(current, runId, (run) => {
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
        updateRun(current, runId, (run) => {
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
            readonly result: ContentRevisionResultResponse
            readonly status: 'approved'
          }
        | {
            readonly message: string
            readonly status: 'rejected'
          }
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updateRun(current, runId, (run) =>
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
          updateRun(current, runId, (run) =>
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
        updateRun(current, runId, (run) =>
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
        updateRun(current, runId, (run) =>
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
        updateRun(current, runId, (run) =>
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
