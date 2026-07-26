import {
  Crypto,
  Effect,
  Exit,
  Match,
  Predicate,
  Ref,
  Schema,
  SubscriptionRef,
} from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'
import { partition } from 'es-toolkit/array'

import {
  type AiWorkflowTarget,
  AiWorkflowTargetSchema,
  type CreateAiWorkflowBatchInput,
  type CreateAiWorkflowJobInput,
  type CreateAiWorkflowJobResult,
  canonicalPreparationUrl,
  PreparationBatchTargetsSchema,
  PreparationJobInputSchema,
  PreparationWorkflowError,
  type PreparationWorkflowPayload,
  PrepareApplicationWorkflow,
} from '../domain'
import { PreparationProgress } from '../progress'

const randomId = Crypto.Crypto.pipe(
  Effect.flatMap((crypto) => crypto.randomUUIDv4)
)

const inputError = Effect.mapError((cause: unknown) =>
  Match.value(cause).pipe(
    Match.when(Schema.is(PreparationWorkflowError), (error) => error),
    Match.orElse(
      (cause) =>
        new PreparationWorkflowError({
          message: Match.value(cause).pipe(
            Match.when(Predicate.isError, (error) => error.message),
            Match.orElse(String)
          ),
          stage: 'input',
        })
    )
  )
)

const canonicalTarget = (target: AiWorkflowTarget): AiWorkflowTarget => ({
  ...target,
  url: canonicalPreparationUrl(target.url),
})

export type PreparedJobStart = {
  readonly batchId: string
  readonly batchPosition: number
  readonly executionId: string
  readonly payload: PreparationWorkflowPayload
  readonly result: CreateAiWorkflowJobResult
  readonly retryOfJobId: string | null
}

const prepareJob = Effect.fn('PreparationWorkflow.prepareJob')(function* (
  input: CreateAiWorkflowJobInput,
  batchId: string,
  batchPosition: number,
  retryOfJobId: string | null
) {
  const jobId = yield* randomId
  const decodedTarget = yield* AiWorkflowTargetSchema.makeEffect({
    ...input.target,
    url: input.target.url.trim(),
  })
  const payload = yield* PreparationJobInputSchema.makeEffect({
    ...input,
    jobId,
    target: canonicalTarget(decodedTarget),
  })
  const executionId = yield* PrepareApplicationWorkflow.executionId(payload)
  return {
    batchId,
    batchPosition,
    executionId,
    payload,
    result: { batchId, jobId },
    retryOfJobId,
  } satisfies PreparedJobStart
})

export const startReservedJobs = Effect.fn(
  'PreparationWorkflow.startReservedJobs'
)(function* (prepared: ReadonlyArray<PreparedJobStart>) {
  const engine = yield* WorkflowEngine.WorkflowEngine
  const progress = yield* PreparationProgress

  return yield* Effect.acquireUseRelease(
    Effect.gen(function* () {
      const attempted = yield* Ref.make<ReadonlySet<string>>(new Set())
      yield* progress.reserve(
        prepared.map(({ batchId, batchPosition, payload, retryOfJobId }) => ({
          batchId,
          batchPosition,
          input: payload,
          retryOfJobId,
        }))
      )
      return attempted
    }),
    (attempted) =>
      Effect.forEach(
        prepared,
        ({ executionId: expectedExecutionId, payload, result }) =>
          Effect.gen(function* () {
            yield* Effect.uninterruptibleMask((restore) =>
              Effect.gen(function* () {
                yield* progress.setExecution(payload.jobId, expectedExecutionId)
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
                  `Workflow execution id mismatch for AI workflow job ${payload.jobId}.`
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
            const [attemptedJobs, unattemptedJobs] = partition(
              prepared,
              ({ executionId }) => attemptedIds.has(executionId)
            )
            yield* progress.releaseReservations(
              unattemptedJobs.map(({ payload }) => payload.jobId)
            )
            yield* Effect.forEach(
              attemptedJobs,
              ({ payload }) =>
                progress.failJob(
                  payload.jobId,
                  'The batch could not finish launching every AI workflow job.'
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

export const createAiWorkflowJob = Effect.fn('PreparationWorkflow.createJob')(
  function* (input: CreateAiWorkflowJobInput) {
    const batchId = yield* randomId
    const prepared = yield* prepareJob(input, batchId, 0, null)
    const results = yield* startReservedJobs([prepared])
    const result = results[0]
    if (result === undefined) {
      return yield* Effect.die('AI workflow startup returned no job.')
    }
    return result
  },
  inputError
)

export const createAiWorkflowBatch = Effect.fn(
  'PreparationWorkflow.createBatch'
)(function* (input: CreateAiWorkflowBatchInput) {
  const batchId = yield* randomId
  const targets = yield* PreparationBatchTargetsSchema.makeEffect(input.targets)
  const prepared = yield* Effect.forEach(
    targets,
    (target, batchPosition) =>
      prepareJob(
        {
          artifacts: input.artifacts,
          locale: input.locale,
          target,
        },
        batchId,
        batchPosition,
        null
      ),
    { concurrency: 4 }
  )
  return yield* startReservedJobs(prepared)
}, inputError)

const retryNotAllowed = (message: string) =>
  new PreparationWorkflowError({ message, stage: 'input' })

export const retryAiWorkflowJob = Effect.fn('PreparationWorkflow.retryJob')(
  function* (jobId: string) {
    const progress = yield* PreparationProgress
    const current = yield* SubscriptionRef.get(progress.jobs)
    const previous = current.get(jobId)
    if (previous === undefined) {
      return yield* Effect.fail(
        retryNotAllowed(`AI workflow job ${jobId} was not found.`)
      )
    }
    if (
      previous.status !== 'failed' &&
      previous.status !== 'cancelled' &&
      previous.status !== 'mixed'
    ) {
      return yield* Effect.fail(
        retryNotAllowed(
          `AI workflow job ${jobId} is not in a retryable terminal state.`
        )
      )
    }

    const batchId = yield* randomId
    const { jobId: _previousJobId, ...input } = previous.input
    const prepared = yield* prepareJob(input, batchId, 0, jobId)
    const results = yield* startReservedJobs([prepared])
    const result = results[0]
    if (result === undefined) {
      return yield* Effect.die('AI workflow retry returned no job.')
    }
    return result
  },
  inputError
)
