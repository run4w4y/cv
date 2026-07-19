import { describe, expect, test } from 'bun:test'
import type { ContentEntry } from '@cv/application-registry-entity'
import { Deferred, Effect, Exit, Fiber, Layer, SubscriptionRef } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  cvPublicationResultAtom,
  cvPublicationRunAtom,
  latestCvPublicationRun,
  type PreparedCvPublicationStart,
  startPreparedCvPublication,
} from './atoms'
import {
  type CvPublicationRun,
  type CvPublicationWorkflowInput,
  PublishCvWorkflow,
} from './domain'
import { CvPublicationProgress, cvPublicationProgressLayer } from './progress'

const recordedAt = '2026-07-18T00:00:00.000Z'

const entry: ContentEntry = {
  applicationId: 'application-1',
  approvedRevisionId: 'revision-1',
  createdAt: recordedAt,
  headRevisionId: 'revision-1',
  id: 'entry-1',
  kind: 'cv',
  locale: 'en',
  state: 'approved',
  updatedAt: recordedAt,
  version: 3,
}

const publicationInput = (runId: string): CvPublicationWorkflowInput => ({
  applicationId: entry.applicationId,
  entry,
  publicBaseUrl: 'https://cv.example.test',
  rendererVersion: 'renderer-v1',
  runId,
})

const prepare = Effect.fn('Test.prepareCvPublicationStartup')(function* (
  payload: CvPublicationWorkflowInput
) {
  const executionId = yield* PublishCvWorkflow.executionId(payload)
  return {
    executionId,
    payload,
    result: { executionId, runId: payload.runId },
  } satisfies PreparedCvPublicationStart
})

const startupTestLayer = Layer.mergeAll(
  cvPublicationProgressLayer,
  WorkflowEngine.layerMemory,
  Reactivity.layer
)

const queued = (runId: string, entryId: string): CvPublicationRun => ({
  _tag: 'Queued',
  applicationId: 'application-1',
  entryId,
  executionId: `execution-${runId}`,
  message: 'queued',
  rendererVersion: 'renderer-v1',
  runId,
})

describe('CV publication atom projections', () => {
  test('uses stable primitive identities for run and result families', () => {
    const identity = {
      applicationId: 'application-1',
      entryId: 'entry-1',
    }

    expect(cvPublicationRunAtom(identity)).toBe(
      cvPublicationRunAtom({ ...identity })
    )
    expect(cvPublicationResultAtom(identity)).toBe(
      cvPublicationResultAtom({ ...identity })
    )
  })

  test('selects the latest run for the requested entry only', () => {
    const runs = new Map([
      ['run-old', queued('run-old', 'entry-1')],
      ['run-other', queued('run-other', 'entry-2')],
      ['run-new', queued('run-new', 'entry-1')],
    ])

    expect(
      latestCvPublicationRun(runs, {
        applicationId: 'application-1',
        entryId: 'entry-1',
      })?.runId
    ).toBe('run-new')
  })
})

describe('CV publication startup', () => {
  test('interrupts a launched workflow and keeps its run visible when startup defects', async () => {
    const observed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const progress = yield* CvPublicationProgress
          const memoryEngine = yield* WorkflowEngine.WorkflowEngine
          yield* memoryEngine.register(PublishCvWorkflow, () => Effect.never)

          const prepared = yield* prepare(publicationInput('run-defect'))
          const attempted: Array<string> = []
          const interrupted: Array<string> = []
          const engine = WorkflowEngine.WorkflowEngine.of({
            ...memoryEngine,
            execute: (workflow, options) =>
              Effect.gen(function* () {
                attempted.push(options.executionId)
                yield* memoryEngine.execute(workflow, options)
                return yield* Effect.die('publication startup exploded')
              }),
            interruptUnsafe: (workflow, executionId) =>
              Effect.sync(() => interrupted.push(executionId)).pipe(
                Effect.andThen(
                  memoryEngine.interruptUnsafe(workflow, executionId)
                )
              ),
          })

          const exit = yield* Effect.exit(
            startPreparedCvPublication(prepared).pipe(
              Effect.provideService(WorkflowEngine.WorkflowEngine, engine)
            )
          )
          return {
            attempted,
            expectedExecutionId: prepared.executionId,
            exit,
            interrupted,
            run: (yield* SubscriptionRef.get(progress.runs)).get(
              prepared.payload.runId
            ),
          }
        })
      ).pipe(Effect.provide(startupTestLayer))
    )

    expect(Exit.isFailure(observed.exit)).toBe(true)
    expect(observed.attempted).toEqual([observed.expectedExecutionId])
    expect(observed.interrupted).toEqual(observed.attempted)
    expect(observed.run?._tag).toBe('Failed')
    if (observed.run?._tag !== 'Failed') throw new Error('Expected failure.')
    expect(observed.run.error.stage).toBe('input')
  })

  test('interrupts a launched workflow and keeps its run visible when startup is interrupted', async () => {
    const observed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const progress = yield* CvPublicationProgress
          const memoryEngine = yield* WorkflowEngine.WorkflowEngine
          yield* memoryEngine.register(PublishCvWorkflow, () => Effect.never)

          const prepared = yield* prepare(publicationInput('run-interrupted'))
          const launched = yield* Deferred.make<void>()
          const interrupted: Array<string> = []
          const engine = WorkflowEngine.WorkflowEngine.of({
            ...memoryEngine,
            execute: (workflow, options) =>
              Effect.gen(function* () {
                yield* memoryEngine.execute(workflow, options)
                yield* Deferred.succeed(launched, undefined)
                return yield* Effect.never
              }),
            interruptUnsafe: (workflow, executionId) =>
              Effect.sync(() => interrupted.push(executionId)).pipe(
                Effect.andThen(
                  memoryEngine.interruptUnsafe(workflow, executionId)
                )
              ),
          })

          const startup = yield* startPreparedCvPublication(prepared).pipe(
            Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
            Effect.forkChild
          )
          yield* Deferred.await(launched)
          yield* Fiber.interrupt(startup)
          return {
            executionId: prepared.executionId,
            interrupted,
            run: (yield* SubscriptionRef.get(progress.runs)).get(
              prepared.payload.runId
            ),
          }
        })
      ).pipe(Effect.provide(startupTestLayer))
    )

    expect(observed.interrupted).toEqual([observed.executionId])
    expect(observed.run?._tag).toBe('Failed')
    if (observed.run?._tag !== 'Failed') throw new Error('Expected failure.')
    expect(observed.run.error.stage).toBe('input')
  })
})
