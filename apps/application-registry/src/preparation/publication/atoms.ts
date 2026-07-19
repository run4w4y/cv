import { WebCryptoLayer } from '@cv/effect-web-crypto'
import { Crypto, Effect, Exit, Layer, Ref } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { publicationMutationReactivityKeys } from '../data/keys'
import { preparationDataLayer } from '../data/runtime'
import {
  type CvPublicationIdentity,
  type CvPublicationRun,
  CvPublicationWorkflowError,
  type CvPublicationWorkflowInput,
  CvPublicationWorkflowInputSchema,
  cvPublicationIdentityKey,
  PublishCvWorkflow,
  publicationRunResult,
  type StartCvPublicationInput,
  type StartCvPublicationResult,
} from './domain'
import { CvPublicationProgress, cvPublicationProgressLayer } from './progress'
import { cvPublicationWorkflowLayer } from './workflow'

const cvPublicationServicesLayer = Layer.mergeAll(
  preparationDataLayer,
  cvPublicationProgressLayer,
  WebCryptoLayer
)

export const cvPublicationRuntimeLayer = cvPublicationWorkflowLayer.pipe(
  Layer.provideMerge(cvPublicationServicesLayer),
  Layer.provideMerge(WorkflowEngine.layerMemory)
)

/** Session-scoped in-memory publication Workflow runtime. Mount once at root. */
export const cvPublicationRuntime = Atom.runtime(
  cvPublicationRuntimeLayer
).pipe(Atom.keepAlive)

export const cvPublicationRunsAtom = cvPublicationRuntime
  .subscriptionRef(Effect.map(CvPublicationProgress, ({ runs }) => runs))
  .pipe(Atom.keepAlive)

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
      publicBaseUrl: input.publicBaseUrl.trim(),
      rendererVersion: input.rendererVersion.trim(),
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

export const latestCvPublicationRun = (
  runs: ReadonlyMap<string, CvPublicationRun>,
  identity: CvPublicationIdentity
): CvPublicationRun | null => {
  let latest: CvPublicationRun | null = null
  const identityKey = cvPublicationIdentityKey(identity)
  for (const run of runs.values()) {
    if (cvPublicationIdentityKey(run) === identityKey) latest = run
  }
  return latest
}

const cvPublicationRunFamily = Atom.family((identityKey: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(cvPublicationRunsAtom), (runs) => {
      let latest: CvPublicationRun | null = null
      for (const run of runs.values()) {
        if (cvPublicationIdentityKey(run) === identityKey) latest = run
      }
      return latest
    })
  )
)

/** Stable progress/result projection keyed by application and CV entry. */
export const cvPublicationRunAtom = (identity: CvPublicationIdentity) =>
  cvPublicationRunFamily(cvPublicationIdentityKey(identity))

const cvPublicationResultFamily = Atom.family((identityKey: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(cvPublicationRunsAtom), (runs) => {
      let latest: CvPublicationRun | null = null
      for (const run of runs.values()) {
        if (cvPublicationIdentityKey(run) === identityKey) latest = run
      }
      return publicationRunResult(latest)
    })
  )
)

/** Stable success-only projection for consumers that do not render progress. */
export const cvPublicationResultAtom = (identity: CvPublicationIdentity) =>
  cvPublicationResultFamily(cvPublicationIdentityKey(identity))
