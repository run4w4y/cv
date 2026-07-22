import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { interruptPreparationExecution } from './review'

describe('preparation cancellation routing', () => {
  test('uses safe interruption for suspended review and unsafe interruption for active work', async () => {
    const calls = await Effect.runPromise(
      Effect.gen(function* () {
        const memory = yield* WorkflowEngine.WorkflowEngine
        const calls = { safe: 0, unsafe: 0 }
        const observed = WorkflowEngine.WorkflowEngine.of({
          ...memory,
          interrupt: (workflow, executionId) =>
            Effect.sync(() => {
              calls.safe += 1
            }).pipe(Effect.andThen(memory.interrupt(workflow, executionId))),
          interruptUnsafe: (workflow, executionId) =>
            Effect.sync(() => {
              calls.unsafe += 1
            }).pipe(
              Effect.andThen(memory.interruptUnsafe(workflow, executionId))
            ),
        })

        yield* interruptPreparationExecution(
          observed,
          'suspended',
          'missing-suspended'
        )
        yield* interruptPreparationExecution(
          observed,
          'active',
          'missing-active'
        )
        return calls
      }).pipe(Effect.provide(WorkflowEngine.layerMemory))
    )

    expect(calls).toEqual({ safe: 1, unsafe: 1 })
  })
})
