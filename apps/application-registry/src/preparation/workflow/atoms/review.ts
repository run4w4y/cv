import { ApplicationPreparation } from '@cv/application-preparation-workflow'
import type { SubmitPreparationReviewInput } from '@cv/application-preparation-workflow/domain'
import { Effect } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { preparationRuntime } from './runtime'

export type { SubmitPreparationReviewInput }

const submitReview = Effect.fn('PreparationAtom.submitReview')(function* (
  input: SubmitPreparationReviewInput
) {
  const preparation = yield* ApplicationPreparation
  return yield* preparation.submitReview(input)
})

export const makeSubmitPreparationReviewAtom = () =>
  preparationRuntime.fn<SubmitPreparationReviewInput>()(submitReview, {
    concurrent: true,
  })

export type CancelPreparationInput = {
  readonly runId: string
}

const cancelPreparation = Effect.fn('PreparationAtom.cancel')(function* (
  input: CancelPreparationInput
) {
  const preparation = yield* ApplicationPreparation
  return yield* preparation.cancel(input.runId)
})

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
