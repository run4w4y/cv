import { ApplicationPreparation } from '@cv/application-preparation-workflow'
import type {
  StartPreparationBatchInput,
  StartPreparationInput,
} from '@cv/application-preparation-workflow/domain'
import { Effect } from 'effect'

import { preparationRuntime } from './runtime'

const startPreparation = Effect.fn('PreparationAtom.start')(function* (
  input: StartPreparationInput
) {
  const preparation = yield* ApplicationPreparation
  return yield* preparation.start(input)
})

const startPreparationBatch = Effect.fn('PreparationAtom.startBatch')(
  function* (input: StartPreparationBatchInput) {
    const preparation = yield* ApplicationPreparation
    return yield* preparation.startBatch(input)
  }
)

export const makeStartPreparationAtom = () =>
  preparationRuntime.fn<StartPreparationInput>()(startPreparation, {
    concurrent: true,
  })

export const startPreparationBatchAtom =
  preparationRuntime.fn<StartPreparationBatchInput>()(startPreparationBatch, {
    concurrent: true,
  })
