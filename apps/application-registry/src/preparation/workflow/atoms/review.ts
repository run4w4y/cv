import { Effect, Exit, SubscriptionRef } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  HumanReview,
  PreparationWorkflowError,
  PrepareApplicationWorkflow,
  type ReviewDecision,
} from '../domain'
import { PreparationGateway } from '../gateway'
import { PreparationProgress } from '../progress'
import { preparationRuntime } from './runtime'

export type SubmitReviewInput = {
  readonly decision: ReviewDecision
  readonly runId: string
  readonly token: DurableDeferred.Token
}

const reviewNoLongerAwaiting = () =>
  new PreparationWorkflowError({
    message: 'This workflow review is no longer awaiting a decision.',
    stage: 'review',
  })

export const makeSubmitPreparationReview = <E, R>(
  complete: (input: SubmitReviewInput) => Effect.Effect<void, E, R>
) =>
  Effect.fn('PreparationWorkflow.submitReview')(function* (
    input: SubmitReviewInput
  ) {
    const { runId, token } = input
    const progress = yield* PreparationProgress
    yield* Effect.uninterruptible(
      Effect.gen(function* () {
        const claimed = yield* progress.reviewSubmitted(runId, token)
        if (!claimed) {
          return yield* Effect.fail(reviewNoLongerAwaiting())
        }
        const completion = yield* Effect.exit(complete(input))
        if (Exit.isFailure(completion)) {
          yield* progress.restoreReview(runId, token)
        }
        return yield* completion
      })
    )
  })

export const makePreflightedSubmitPreparationReview = <
  E,
  R,
  PreflightError,
  PreflightRequirements,
>(
  preflight: (
    input: SubmitReviewInput
  ) => Effect.Effect<void, PreflightError, PreflightRequirements>,
  complete: (input: SubmitReviewInput) => Effect.Effect<void, E, R>
) => {
  const submit = makeSubmitPreparationReview(complete)
  return Effect.fn('PreparationWorkflow.submitReviewWithPreflight')(function* (
    input: SubmitReviewInput
  ) {
    yield* preflight(input)
    return yield* submit(input)
  })
}

/**
 * Checks fresh registry ancestry before the review token is claimed. The
 * Workflow repeats the same verification immediately before approval.
 */
export const preflightPreparationReview = Effect.fn(
  'PreparationWorkflow.preflightReview'
)(function* (input: SubmitReviewInput) {
  if (input.decision._tag === 'Rejected') return

  const progress = yield* PreparationProgress
  const runs = yield* SubscriptionRef.get(progress.runs)
  const run = runs.get(input.runId)
  if (
    run === undefined ||
    run.status !== 'awaiting_review' ||
    run.reviewToken !== input.token
  ) {
    return yield* Effect.fail(reviewNoLongerAwaiting())
  }

  const gateway = yield* PreparationGateway
  yield* gateway.verifyBoundRevision(run.candidate, input.decision.revisionId)
})

export const submitPreparationReview = makePreflightedSubmitPreparationReview(
  preflightPreparationReview,
  ({ decision, token }) =>
    DurableDeferred.succeed(HumanReview, {
      token,
      value: decision,
    })
)

export const makeSubmitPreparationReviewAtom = () =>
  preparationRuntime.fn<SubmitReviewInput>()(submitPreparationReview, {
    concurrent: true,
  })

export type CancelPreparationInput = {
  readonly executionId: string
  readonly runId: string
}

export const interruptPreparationExecution = (
  engine: WorkflowEngine.WorkflowEngine['Service'],
  mode: 'active' | 'suspended',
  executionId: string
): Effect.Effect<void> =>
  mode === 'suspended'
    ? engine.interrupt(PrepareApplicationWorkflow, executionId)
    : engine.interruptUnsafe(PrepareApplicationWorkflow, executionId)

export const cancelPreparation = Effect.fn('PreparationWorkflow.cancel')(
  function* ({ executionId, runId }: CancelPreparationInput) {
    const engine = yield* WorkflowEngine.WorkflowEngine
    const progress = yield* PreparationProgress
    yield* Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        const claimed = yield* progress.requestCancel(runId, executionId)
        if (claimed === null) return
        const interruption = yield* Effect.exit(
          restore(
            interruptPreparationExecution(engine, claimed.mode, executionId)
          )
        )
        if (Exit.isFailure(interruption)) {
          yield* progress.restoreCancellation(runId, executionId, claimed)
          return yield* interruption
        }
        yield* progress.cancel(runId)
      })
    )
  }
)

export const cancelPreparationAtom =
  preparationRuntime.fn<CancelPreparationInput>()(cancelPreparation, {
    concurrent: true,
  })

const cancelPreparationRunFamily = Atom.family((_runId: string) =>
  preparationRuntime.fn<CancelPreparationInput>()(cancelPreparation, {
    concurrent: true,
  })
)

/** Keeps cancellation progress and failures isolated to the affected run card. */
export const cancelPreparationRunAtom = (runId: string) =>
  cancelPreparationRunFamily(runId)
