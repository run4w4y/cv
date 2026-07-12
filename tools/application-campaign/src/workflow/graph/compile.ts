import { Data, Effect } from 'effect'
import type { CompiledWorkflowGraph, WorkflowStep } from './types'

export class WorkflowGraphError extends Data.TaggedError('WorkflowGraphError')<{
  readonly message: string
}> {}

const duplicates = (values: readonly string[]) => {
  const seen = new Set<string>()
  const repeated = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }

  return [...repeated]
}

export const compileWorkflowGraph = <R>(
  steps: readonly WorkflowStep<R>[],
  options: { readonly externalDependencies?: readonly string[] } = {}
): Effect.Effect<CompiledWorkflowGraph<R>, WorkflowGraphError> =>
  Effect.gen(function* () {
    const repeated = duplicates(steps.map((step) => step.id))
    if (repeated.length > 0) {
      return yield* new WorkflowGraphError({
        message: `Workflow step ids must be unique. Repeated: ${repeated.join(', ')}.`,
      })
    }

    const byId = new Map(steps.map((step) => [step.id, step]))
    const external = new Set(options.externalDependencies ?? [])

    for (const step of steps) {
      const repeatedDependencies = duplicates(step.dependsOn ?? [])
      if (repeatedDependencies.length > 0) {
        return yield* new WorkflowGraphError({
          message: `Workflow step "${step.id}" repeats dependencies: ${repeatedDependencies.join(', ')}.`,
        })
      }

      for (const dependency of step.dependsOn ?? []) {
        if (!byId.has(dependency) && !external.has(dependency)) {
          return yield* new WorkflowGraphError({
            message: `Workflow step "${step.id}" depends on missing step "${dependency}".`,
          })
        }
      }
    }

    const remaining = new Map(byId)
    const resolved = new Set(external)
    const layers: WorkflowStep<R>[][] = []

    while (remaining.size > 0) {
      const layer = steps.filter(
        (step) =>
          remaining.has(step.id) &&
          (step.dependsOn ?? []).every((dependency) => resolved.has(dependency))
      )

      if (layer.length === 0) {
        return yield* new WorkflowGraphError({
          message: `Workflow contains a dependency cycle involving: ${[...remaining.keys()].join(', ')}.`,
        })
      }

      layers.push(layer)
      for (const step of layer) {
        remaining.delete(step.id)
        resolved.add(step.id)
      }
    }

    return { layers, steps }
  })
