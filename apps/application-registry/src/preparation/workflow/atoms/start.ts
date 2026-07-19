import { Crypto, Effect, Exit, Ref } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  canonicalPreparationUrl,
  HttpUrlSchema,
  PreparationBatchUrlsSchema,
  type PreparationWorkflowInput,
  PreparationWorkflowInputSchema,
  PrepareApplicationWorkflow,
  type StartPreparationBatchInput,
  type StartPreparationInput,
  type StartPreparationResult,
} from '../domain'
import { PreparationProgress } from '../progress'
import { preparationRuntime } from './runtime'

const randomRunId = Crypto.Crypto.pipe(
  Effect.flatMap((crypto) => crypto.randomUUIDv4)
)

export type PreparedStart = {
  readonly executionId: string
  readonly payload: PreparationWorkflowInput
  readonly result: StartPreparationResult
}

const prepareStart = Effect.fn('PreparationWorkflow.prepareStart')(function* (
  input: StartPreparationInput
) {
  const runId = yield* randomRunId
  const decoded = yield* PreparationWorkflowInputSchema.makeEffect({
    coverLetterPrompt: input.coverLetterPrompt,
    kind: input.kind,
    locale: input.locale,
    modelId: input.modelId,
    runId,
    source: {
      ...input.source,
      url: input.source.url.trim(),
    },
  })
  const payload = {
    ...decoded,
    source: {
      ...decoded.source,
      url: canonicalPreparationUrl(decoded.source.url),
    },
  }
  const executionId = yield* PrepareApplicationWorkflow.executionId(payload)
  return {
    executionId,
    payload,
    result: { executionId, runId },
  } satisfies PreparedStart
})

export const startReservedPreparations = Effect.fn(
  'PreparationWorkflow.startReserved'
)(function* (prepared: ReadonlyArray<PreparedStart>) {
  const engine = yield* WorkflowEngine.WorkflowEngine
  const progress = yield* PreparationProgress
  const runIds = prepared.map(({ payload }) => payload.runId)

  return yield* Effect.acquireUseRelease(
    Effect.gen(function* () {
      const attempted = yield* Ref.make<ReadonlySet<string>>(new Set())
      yield* progress.reserve(prepared.map(({ payload }) => payload))
      return attempted
    }),
    (attempted) =>
      Effect.forEach(
        prepared,
        ({ executionId: expectedExecutionId, payload, result }) =>
          Effect.gen(function* () {
            yield* Effect.uninterruptibleMask((restore) =>
              Effect.gen(function* () {
                yield* progress.setExecution(payload.runId, expectedExecutionId)
                yield* Ref.update(attempted, (current) => {
                  const next = new Set(current)
                  next.add(expectedExecutionId)
                  return next
                })
                const executionId = yield* restore(
                  PrepareApplicationWorkflow.execute(payload, {
                    discard: true,
                  })
                )
                if (executionId === expectedExecutionId) return
                yield* Ref.update(attempted, (current) => {
                  const next = new Set(current)
                  next.add(executionId)
                  return next
                })
                return yield* Effect.die(
                  `Workflow execution id mismatch for preparation run ${payload.runId}.`
                )
              })
            )
            return result
          }),
        { concurrency: 4 }
      ),
    (attempted, exit) =>
      Exit.isSuccess(exit)
        ? Effect.void
        : Effect.gen(function* () {
            const attemptedIds = yield* Ref.get(attempted)
            const attemptedRuns = prepared.filter(({ executionId }) =>
              attemptedIds.has(executionId)
            )
            const attemptedRunIds = new Set(
              attemptedRuns.map(({ payload }) => payload.runId)
            )
            yield* progress.releaseReservations(
              runIds.filter((runId) => !attemptedRunIds.has(runId))
            )
            yield* Effect.forEach(
              attemptedRuns,
              ({ payload }) =>
                progress.fail(
                  payload.runId,
                  'The batch could not finish launching every preparation job.'
                ),
              { discard: true }
            )
            yield* Effect.forEach(
              attemptedIds,
              (executionId) =>
                Effect.exit(
                  engine.interruptUnsafe(
                    PrepareApplicationWorkflow,
                    executionId
                  )
                ),
              { concurrency: 4, discard: true }
            )
          })
  )
})

const startOne = Effect.fn('PreparationWorkflow.start')(function* (
  input: StartPreparationInput
) {
  const prepared = yield* prepareStart(input)
  const results = yield* startReservedPreparations([prepared])
  const result = results[0]
  if (result === undefined) {
    return yield* Effect.die('Single preparation startup returned no result.')
  }
  return result
})

export const makeStartPreparationAtom = () =>
  preparationRuntime.fn<StartPreparationInput>()(startOne, { concurrent: true })

export const startPreparationBatchAtom =
  preparationRuntime.fn<StartPreparationBatchInput>()(
    Effect.fn('PreparationWorkflow.startBatch')(function* (input) {
      const decodedUrls = yield* Effect.forEach(
        input.urls.map((url) => url.trim()).filter(Boolean),
        (url) => HttpUrlSchema.makeEffect(url)
      )
      const urls = [...new Set(decodedUrls.map(canonicalPreparationUrl))]
      const validated = yield* PreparationBatchUrlsSchema.makeEffect(urls)
      const prepared = yield* Effect.forEach(
        validated,
        (url) =>
          prepareStart({
            coverLetterPrompt: input.coverLetterPrompt,
            kind: input.kind,
            locale: input.locale,
            modelId: input.modelId,
            source: {
              _tag: 'CaptureUrl',
              url,
            },
          }),
        { concurrency: 4 }
      )
      return yield* startReservedPreparations(prepared)
    }),
    { concurrent: true }
  )
