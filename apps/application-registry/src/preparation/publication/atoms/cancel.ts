import { Effect, Exit } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { publicationMutationReactivityKeys } from '@/preparation/data/keys'
import { PublishCvWorkflow } from '../domain'
import { CvPublicationProgress } from '../progress'
import { cvPublicationRuntime } from './runtime'

export type CancelCvPublicationInput = {
  readonly executionId: string
  readonly runId: string
}

export const cancelCvPublication = Effect.fn('PublishCv.cancel')(function* (
  input: CancelCvPublicationInput
) {
  const engine = yield* WorkflowEngine.WorkflowEngine
  const progress = yield* CvPublicationProgress
  yield* Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const claim = yield* progress.requestCancel(
        input.runId,
        input.executionId
      )
      if (claim === null) return
      // This runtime is intentionally session-local and has no child workflows.
      // Unsafe interruption makes cancellation immediate during Schedule sleeps.
      const interruption = yield* Effect.exit(
        restore(engine.interruptUnsafe(PublishCvWorkflow, input.executionId))
      )
      if (Exit.isFailure(interruption)) {
        yield* progress.restoreCancellation(
          input.runId,
          input.executionId,
          claim
        )
        return yield* interruption
      }
      yield* progress.cancel(input.runId)
      yield* Reactivity.invalidate(
        publicationMutationReactivityKeys(
          claim.previous.applicationId,
          claim.previous.entryId
        )
      )
    })
  )
})

export const makeCancelCvPublicationAtom = () =>
  cvPublicationRuntime.fn<CancelCvPublicationInput>()(cancelCvPublication, {
    concurrent: true,
  })
