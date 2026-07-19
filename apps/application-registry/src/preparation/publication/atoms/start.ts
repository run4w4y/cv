import { Crypto, Effect, Exit, Ref } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { publicationMutationReactivityKeys } from '@/preparation/data/keys'
import {
  CvPublicationWorkflowError,
  type CvPublicationWorkflowInput,
  CvPublicationWorkflowInputSchema,
  PublishCvWorkflow,
  type StartCvPublicationInput,
  type StartCvPublicationResult,
} from '../domain'
import { CvPublicationProgress } from '../progress'
import { cvPublicationRuntime } from './runtime'

const inputError = (cause: unknown) =>
  new CvPublicationWorkflowError({
    message: String(cause),
    stage: 'input',
  })

export type PreparedCvPublicationStart = {
  readonly executionId: string
  readonly payload: CvPublicationWorkflowInput
  readonly result: StartCvPublicationResult
}

export const prepareCvPublicationStart = Effect.fn('PublishCv.prepareStart')(
  function* (input: StartCvPublicationInput) {
    const crypto = yield* Crypto.Crypto
    const runId = yield* crypto.randomUUIDv4
    const payload = yield* CvPublicationWorkflowInputSchema.makeEffect({
      applicationId: input.applicationId.trim(),
      entry: input.entry,
      expectedPublicationVersion: input.expectedPublicationVersion,
      runId,
    }).pipe(Effect.mapError(inputError))
    const executionId = yield* PublishCvWorkflow.executionId(payload)
    return {
      executionId,
      payload,
      result: { executionId, runId },
    } satisfies PreparedCvPublicationStart
  }
)

export const startPreparedCvPublication = Effect.fn('PublishCv.startPrepared')(
  function* (prepared: PreparedCvPublicationStart) {
    const engine = yield* WorkflowEngine.WorkflowEngine
    const progress = yield* CvPublicationProgress

    return yield* Effect.acquireUseRelease(
      Effect.gen(function* () {
        const attempted = yield* Ref.make<ReadonlySet<string>>(new Set())
        yield* progress.reserve(prepared.payload, prepared.executionId)
        return attempted
      }),
      (attempted) =>
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            yield* Ref.update(attempted, (current) => {
              const next = new Set(current)
              next.add(prepared.executionId)
              return next
            })
            const executionId = yield* restore(
              PublishCvWorkflow.execute(prepared.payload, {
                discard: true,
              })
            )
            if (executionId !== prepared.executionId) {
              yield* Ref.update(attempted, (current) => {
                const next = new Set(current)
                next.add(executionId)
                return next
              })
              return yield* Effect.die(
                `Workflow execution id mismatch for publication run ${prepared.payload.runId}.`
              )
            }
            return prepared.result
          })
        ),
      (attempted, exit) =>
        Exit.isSuccess(exit)
          ? Effect.void
          : Effect.gen(function* () {
              const attemptedIds = yield* Ref.get(attempted)
              if (attemptedIds.size === 0) {
                yield* progress.releaseReservation(prepared.payload.runId)
                return
              }
              yield* progress.fail(
                prepared.payload.runId,
                new CvPublicationWorkflowError({
                  message:
                    'The publication workflow could not finish launching for this browser session.',
                  stage: 'input',
                })
              )
              yield* Effect.forEach(
                attemptedIds,
                (executionId) =>
                  Effect.exit(
                    engine.interruptUnsafe(PublishCvWorkflow, executionId)
                  ),
                { concurrency: 4, discard: true }
              )
              yield* Reactivity.invalidate(
                publicationMutationReactivityKeys(
                  prepared.payload.applicationId,
                  prepared.payload.entry.id
                )
              )
            })
    )
  }
)

export const startCvPublication = Effect.fn('PublishCv.start')(function* (
  input: StartCvPublicationInput
) {
  const prepared = yield* prepareCvPublicationStart(input)
  return yield* startPreparedCvPublication(prepared)
})

export const makeStartCvPublicationAtom = () =>
  cvPublicationRuntime.fn<StartCvPublicationInput>()(startCvPublication, {
    concurrent: true,
  })
