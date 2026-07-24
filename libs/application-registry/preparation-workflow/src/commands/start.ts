import { Crypto, Effect, Exit, Match, Predicate, Ref, Schema } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'
import { compact, partition, uniq } from 'es-toolkit/array'

import {
  canonicalPreparationUrl,
  HttpUrlSchema,
  normalizePreparationJobInput,
  PreparationBatchUrlsSchema,
  PreparationJobInputSchema,
  PreparationWorkflowError,
  type PreparationWorkflowPayload,
  PrepareApplicationWorkflow,
  preparationJobArtifactInputs,
  type StartPreparationBatchInput,
  type StartPreparationInput,
  type StartPreparationResult,
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

export type PreparedStart = {
  readonly batchId: string
  readonly batchPosition: number
  readonly executionId: string
  readonly payload: PreparationWorkflowPayload
  readonly result: StartPreparationResult
}

type PrepareJobInput = {
  readonly coverLetterPrompt: string | null
  readonly cvGenerationGuidance:
    | StartPreparationBatchInput['cvGenerationGuidance']
    | null
  readonly includeCoverLetter: boolean
  readonly includeCv: boolean
  readonly locale: StartPreparationBatchInput['locale']
  readonly source: StartPreparationInput['source']
}

const prepareJob = Effect.fn('PreparationWorkflow.prepareJob')(function* (
  input: PrepareJobInput,
  batchId: string,
  batchPosition: number
) {
  const jobId = yield* randomId
  const coverLetterRunId = input.includeCoverLetter
    ? input.includeCv
      ? yield* randomId
      : jobId
    : null
  const decoded = yield* PreparationJobInputSchema.makeEffect({
    coverLetterPrompt: input.coverLetterPrompt,
    cvGenerationGuidance: input.cvGenerationGuidance,
    jobId,
    locale: input.locale,
    runIds: {
      coverLetter: coverLetterRunId,
      cv: input.includeCv ? jobId : null,
    },
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
    batchId,
    batchPosition,
    executionId,
    payload,
    result: { batchId, jobId, runId: jobId },
  } satisfies PreparedStart
})

const prepareStart = Effect.fn('PreparationWorkflow.prepareStart')(function* (
  input: StartPreparationInput,
  batchId: string,
  batchPosition: number
) {
  return yield* prepareJob(
    {
      coverLetterPrompt: input.coverLetterPrompt,
      cvGenerationGuidance: input.cvGenerationGuidance,
      includeCoverLetter: input.kind === 'cover_letter',
      includeCv: input.kind === 'cv',
      locale: input.locale,
      source: input.source,
    },
    batchId,
    batchPosition
  )
})

export const startReservedPreparations = Effect.fn(
  'PreparationWorkflow.startReserved'
)(function* (prepared: ReadonlyArray<PreparedStart>) {
  const engine = yield* WorkflowEngine.WorkflowEngine
  const progress = yield* PreparationProgress

  return yield* Effect.acquireUseRelease(
    Effect.gen(function* () {
      const attempted = yield* Ref.make<ReadonlySet<string>>(new Set())
      yield* progress.reserve(
        prepared.flatMap(({ batchId, batchPosition, payload }) => {
          const job = normalizePreparationJobInput(payload)
          return preparationJobArtifactInputs(job).map((input) => ({
            batchId,
            batchPosition,
            input,
            jobId: job.jobId,
          }))
        })
      )
      return attempted
    }),
    (attempted) =>
      Effect.forEach(
        prepared,
        ({ executionId: expectedExecutionId, payload, result }) =>
          Effect.gen(function* () {
            const job = normalizePreparationJobInput(payload)
            yield* Effect.uninterruptibleMask((restore) =>
              Effect.gen(function* () {
                yield* progress.setExecution(job.jobId, expectedExecutionId)
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
                  `Workflow execution id mismatch for preparation job ${job.jobId}.`
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
            const [attemptedRuns, unattemptedRuns] = partition(
              prepared,
              ({ executionId }) => attemptedIds.has(executionId)
            )
            yield* progress.releaseReservations(
              unattemptedRuns.flatMap(({ payload }) => {
                const job = normalizePreparationJobInput(payload)
                return preparationJobArtifactInputs(job).map(
                  ({ runId }) => runId
                )
              })
            )
            yield* Effect.forEach(
              attemptedRuns,
              ({ payload }) => {
                const job = normalizePreparationJobInput(payload)
                return progress.failJob(
                  job.jobId,
                  'The batch could not finish launching every preparation job.'
                )
              },
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

export const startPreparation = Effect.fn('PreparationWorkflow.start')(
  function* (input: StartPreparationInput) {
    const batchId = yield* randomId
    const prepared = yield* prepareStart(input, batchId, 0)
    const results = yield* startReservedPreparations([prepared])
    const result = results[0]
    if (result === undefined) {
      return yield* Effect.die('Single preparation startup returned no result.')
    }
    return result
  },
  inputError
)

export const startPreparationBatch = Effect.fn(
  'PreparationWorkflow.startBatch'
)(function* (input: StartPreparationBatchInput) {
  const batchId = yield* randomId
  const decodedUrls = yield* Effect.forEach(
    compact(input.urls.map((url) => url.trim())),
    (url) => HttpUrlSchema.makeEffect(url)
  )
  const urls = uniq(decodedUrls.map(canonicalPreparationUrl))
  const validated = yield* PreparationBatchUrlsSchema.makeEffect(urls)
  const preparedByUrl = yield* Effect.forEach(
    validated,
    (url, batchPosition) =>
      prepareJob(
        {
          coverLetterPrompt: input.coverLetterPrompt,
          cvGenerationGuidance: input.cvGenerationGuidance,
          includeCoverLetter: input.includeCoverLetter,
          includeCv: true,
          locale: input.locale,
          source: {
            _tag: 'CaptureUrl',
            url,
          },
        },
        batchId,
        batchPosition
      ),
    { concurrency: 4 }
  )
  return yield* startReservedPreparations(preparedByUrl)
}, inputError)
