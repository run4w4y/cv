import { describe, expect, test } from 'bun:test'
import { Deferred, Effect, Fiber, Ref } from 'effect'
import { compileWorkflowGraph } from './compile'
import { executeWorkflowGraph } from './execute'
import { WorkflowOutputs, workflowKey, workflowOutput } from './key'
import type { WorkflowStep } from './types'

const value = workflowKey<number>('value')
const doubled = workflowKey<number>('doubled')

const step = (
  input: Pick<WorkflowStep, 'dependsOn' | 'execute' | 'id'> &
    Partial<Pick<WorkflowStep, 'failurePolicy' | 'scope'>>
): WorkflowStep => ({
  failurePolicy: input.failurePolicy ?? 'fail-run',
  label: input.id,
  scope: input.scope ?? 'run',
  ...input,
})

describe('workflow graph', () => {
  test('executes dependency layers with typed immutable outputs', async () => {
    const graph = await Effect.runPromise(
      compileWorkflowGraph([
        step({
          execute: () => Effect.succeed([workflowOutput(value, 4)]),
          id: 'produce',
        }),
        step({
          dependsOn: ['produce'],
          execute: ({ outputs }) =>
            outputs
              .get(value)
              .pipe(
                Effect.map((input) => [workflowOutput(doubled, input * 2)])
              ),
          id: 'consume',
        }),
      ])
    )

    const result = await Effect.runPromise(
      executeWorkflowGraph({ graph, initialOutputs: WorkflowOutputs.empty })
    )

    expect(result.status).toBe('succeeded')
    expect(await Effect.runPromise(result.outputs.get(doubled))).toBe(8)
  })

  test('rejects duplicate, missing and cyclic definitions', async () => {
    const noop = (id: string, dependsOn: readonly string[] = []) =>
      step({ dependsOn, execute: () => Effect.succeed([]), id })

    await expect(
      Effect.runPromise(compileWorkflowGraph([noop('same'), noop('same')]))
    ).rejects.toThrow('unique')
    await expect(
      Effect.runPromise(compileWorkflowGraph([noop('one', ['missing'])]))
    ).rejects.toThrow('missing')
    await expect(
      Effect.runPromise(
        compileWorkflowGraph([noop('one', ['two']), noop('two', ['one'])])
      )
    ).rejects.toThrow('cycle')
    await expect(
      Effect.runPromise(
        compileWorkflowGraph([noop('one'), noop('two', ['one', 'one'])])
      )
    ).rejects.toThrow('repeats dependencies')
  })

  test('keeps distinct typed keys with the same display id isolated', async () => {
    const numeric = workflowKey<number>('shared-id')
    const textual = workflowKey<string>('shared-id')
    const outputs = await Effect.runPromise(
      WorkflowOutputs.from([workflowOutput(numeric, 42)])
    )

    expect(outputs.getOption(textual)._tag).toBe('None')
    await expect(Effect.runPromise(outputs.get(textual))).rejects.toThrow(
      'unavailable'
    )
    await expect(
      Effect.runPromise(outputs.addAll([workflowOutput(textual, 'forty-two')]))
    ).rejects.toThrow('more than once')
  })

  test('applies warn, fail-target, and fail-run policies', async () => {
    const warningGraph = await Effect.runPromise(
      compileWorkflowGraph([
        step({
          execute: () => Effect.fail(new Error('optional failure')),
          failurePolicy: 'warn',
          id: 'optional',
        }),
        step({
          dependsOn: ['optional'],
          execute: () => Effect.succeed([workflowOutput(value, 7)]),
          id: 'after-optional',
        }),
      ])
    )
    const warningResult = await Effect.runPromise(
      executeWorkflowGraph({
        graph: warningGraph,
        initialOutputs: WorkflowOutputs.empty,
      })
    )

    expect(warningResult.status).toBe('succeeded')
    expect(warningResult.issues).toHaveLength(1)
    expect(await Effect.runPromise(warningResult.outputs.get(value))).toBe(7)

    let downstreamRan = false
    const targetGraph = await Effect.runPromise(
      compileWorkflowGraph([
        step({
          execute: () => Effect.fail(new Error('target failure')),
          failurePolicy: 'fail-target',
          id: 'target-failure',
          scope: 'target',
        }),
        step({
          dependsOn: ['target-failure'],
          execute: () =>
            Effect.sync(() => {
              downstreamRan = true
              return []
            }),
          id: 'after-target-failure',
          scope: 'target',
        }),
      ])
    )
    const targetResult = await Effect.runPromise(
      executeWorkflowGraph({
        graph: targetGraph,
        initialOutputs: WorkflowOutputs.empty,
      })
    )

    expect(targetResult.status).toBe('failed')
    expect(downstreamRan).toBe(false)

    const runGraph = await Effect.runPromise(
      compileWorkflowGraph([
        step({
          execute: () => Effect.fail(new Error('run failure')),
          id: 'run-failure',
        }),
      ])
    )
    await expect(
      Effect.runPromise(
        executeWorkflowGraph({
          graph: runGraph,
          initialOutputs: WorkflowOutputs.empty,
        })
      )
    ).rejects.toThrow('run-failure')
  })

  test('runs independent steps in the same dependency layer concurrently', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Ref.make(0)
        const bothStarted = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const concurrentStep = (id: string) =>
          step({
            execute: () =>
              Effect.gen(function* () {
                const count = yield* Ref.updateAndGet(
                  started,
                  (value) => value + 1
                )
                if (count === 2) {
                  yield* Deferred.succeed(bothStarted, undefined)
                }
                yield* Deferred.await(release)
                return []
              }),
            id,
          })
        const graph = yield* compileWorkflowGraph([
          concurrentStep('left'),
          concurrentStep('right'),
        ])
        const fiber = yield* Effect.forkChild(
          executeWorkflowGraph({
            graph,
            initialOutputs: WorkflowOutputs.empty,
          })
        )

        yield* Deferred.await(bothStarted)
        yield* Deferred.succeed(release, undefined)
        return yield* Fiber.join(fiber)
      })
    )

    expect(result.status).toBe('succeeded')
  })
})
