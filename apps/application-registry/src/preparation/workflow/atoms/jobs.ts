import { ApplicationPreparation } from '@cv/application-preparation-workflow'
import { Effect } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { preparationRuntime } from './runtime'

export type CancelAiWorkflowJobInput = {
  readonly jobId: string
}

const cancelJob = Effect.fn('PreparationAtom.cancelJob')(function* (
  input: CancelAiWorkflowJobInput
) {
  const preparation = yield* ApplicationPreparation
  return yield* preparation.cancelJob(input.jobId)
})

export const cancelAiWorkflowJobAtom =
  preparationRuntime.fn<CancelAiWorkflowJobInput>()(cancelJob, {
    concurrent: true,
  })

const cancelJobFamily = Atom.family((_jobId: string) =>
  preparationRuntime.fn<CancelAiWorkflowJobInput>()(cancelJob, {
    concurrent: true,
  })
)

/** Keeps cancellation progress and failures isolated to the affected job. */
export const cancelAiWorkflowJobFamily = (jobId: string) =>
  cancelJobFamily(jobId)
