import { describe, expect, test } from 'bun:test'
import { Deferred, Effect, Exit, Fiber, Layer, SubscriptionRef } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'
import {
  type PreparationWorkflowInput,
  PrepareApplicationWorkflow,
} from '../domain'
import { PreparationProgress, preparationProgressLayer } from '../progress'
import { type PreparedStart, startReservedPreparations } from './start'

const workflowInput = (
  runId: string,
  url: string
): PreparationWorkflowInput => ({
  coverLetterPrompt: null,
  kind: 'cv',
  locale: 'en',
  modelId: 'model-1',
  runId,
  source: { _tag: 'CaptureUrl', url },
})

const prepare = Effect.fn('Test.prepareStartup')(function* (
  payload: PreparationWorkflowInput
) {
  const executionId = yield* PrepareApplicationWorkflow.executionId(payload)
  return {
    executionId,
    payload,
    result: { runId: payload.runId },
  } satisfies PreparedStart
})

const startupTestLayer = Layer.merge(
  preparationProgressLayer,
  WorkflowEngine.layerMemory
)

describe('preparation batch startup', () => {
  test('rejects the whole batch before invoking the workflow engine', async () => {
    const observed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const progress = yield* PreparationProgress
          const memoryEngine = yield* WorkflowEngine.WorkflowEngine
          const existing = workflowInput(
            'run-existing',
            'https://jobs.example.test/existing'
          )
          yield* progress.register(existing)

          const first = yield* prepare(
            workflowInput('run-new', 'https://jobs.example.test/new')
          )
          const conflict = yield* prepare({
            ...existing,
            runId: 'run-conflict',
          })
          const attempted: Array<string> = []
          const engine = WorkflowEngine.WorkflowEngine.of({
            ...memoryEngine,
            execute: (_workflow, options) =>
              Effect.sync(() => attempted.push(options.executionId)).pipe(
                Effect.andThen(Effect.die('engine must not be invoked'))
              ),
          })

          const exit = yield* Effect.exit(
            startReservedPreparations([first, conflict]).pipe(
              Effect.provideService(WorkflowEngine.WorkflowEngine, engine)
            )
          )
          return {
            attempted,
            exit,
            runs: yield* SubscriptionRef.get(progress.runs),
          }
        })
      ).pipe(Effect.provide(startupTestLayer))
    )

    expect(Exit.isFailure(observed.exit)).toBe(true)
    expect(observed.attempted).toEqual([])
    expect([...observed.runs.keys()]).toEqual(['run-existing'])
  })

  test('rolls back every reservation and interrupts every attempted launch on a defect', async () => {
    const observed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const progress = yield* PreparationProgress
          const memoryEngine = yield* WorkflowEngine.WorkflowEngine
          yield* memoryEngine.register(
            PrepareApplicationWorkflow,
            () => Effect.never
          )

          const first = yield* prepare(
            workflowInput('run-start-1', 'https://jobs.example.test/role-1')
          )
          const second = yield* prepare(
            workflowInput('run-start-2', 'https://jobs.example.test/role-2')
          )
          const bothStarted = yield* Deferred.make<void>()
          const attempted: Array<string> = []
          const interrupted: Array<string> = []
          const engine = WorkflowEngine.WorkflowEngine.of({
            ...memoryEngine,
            execute: (workflow, options) =>
              Effect.gen(function* () {
                attempted.push(options.executionId)
                if (attempted.length === 2) {
                  yield* Deferred.succeed(bothStarted, undefined)
                }
                yield* Deferred.await(bothStarted)
                if (options.executionId === second.executionId) {
                  return yield* Effect.die('startup exploded')
                }
                return yield* memoryEngine.execute(workflow, options)
              }),
            interruptUnsafe: (workflow, executionId) =>
              Effect.sync(() => interrupted.push(executionId)).pipe(
                Effect.andThen(
                  memoryEngine.interruptUnsafe(workflow, executionId)
                )
              ),
          })

          const exit = yield* Effect.exit(
            startReservedPreparations([first, second]).pipe(
              Effect.provideService(WorkflowEngine.WorkflowEngine, engine)
            )
          )
          const runs = yield* SubscriptionRef.get(progress.runs)
          return {
            attempted,
            exit,
            expectedIds: [first.executionId, second.executionId],
            interrupted,
            runs,
          }
        })
      ).pipe(Effect.provide(startupTestLayer))
    )

    expect(Exit.isFailure(observed.exit)).toBe(true)
    expect(new Set(observed.attempted)).toEqual(new Set(observed.expectedIds))
    expect(new Set(observed.interrupted)).toEqual(new Set(observed.expectedIds))
    expect(observed.runs.size).toBe(2)
    expect([...observed.runs.values()].map(({ status }) => status)).toEqual([
      'failed',
      'failed',
    ])
  })

  test('keeps attempted runs visible and releases only the unlaunched reservation when startup is interrupted', async () => {
    const observed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const progress = yield* PreparationProgress
          const memoryEngine = yield* WorkflowEngine.WorkflowEngine
          const fourAttempted = yield* Deferred.make<void>()
          const attempted: Array<string> = []
          const interrupted: Array<string> = []
          const engine = WorkflowEngine.WorkflowEngine.of({
            ...memoryEngine,
            execute: (_workflow, options) =>
              Effect.gen(function* () {
                attempted.push(options.executionId)
                if (attempted.length === 4) {
                  yield* Deferred.succeed(fourAttempted, undefined)
                }
                return yield* Effect.never
              }),
            interruptUnsafe: (workflow, executionId) =>
              Effect.sync(() => interrupted.push(executionId)).pipe(
                Effect.andThen(
                  memoryEngine.interruptUnsafe(workflow, executionId)
                )
              ),
          })
          const prepared = yield* Effect.forEach([0, 1, 2, 3, 4], (index) =>
            prepare(
              workflowInput(
                `run-interrupted-${index}`,
                `https://jobs.example.test/interrupted-${index}`
              )
            )
          )
          const startup = yield* startReservedPreparations(prepared).pipe(
            Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
            Effect.forkChild
          )
          yield* Deferred.await(fourAttempted)
          yield* Fiber.interrupt(startup)

          return {
            attempted,
            interrupted,
            prepared,
            runs: yield* SubscriptionRef.get(progress.runs),
          }
        })
      ).pipe(Effect.provide(startupTestLayer))
    )

    expect(new Set(observed.interrupted)).toEqual(new Set(observed.attempted))
    expect(observed.attempted).toHaveLength(4)
    const unlaunched = observed.prepared.find(
      ({ executionId }) => !observed.attempted.includes(executionId)
    )
    expect(unlaunched).toBeDefined()
    expect(observed.runs.has(unlaunched?.payload.runId ?? '')).toBe(false)
    expect([...observed.runs.values()].map(({ status }) => status)).toEqual([
      'failed',
      'failed',
      'failed',
      'failed',
    ])
  })
})
