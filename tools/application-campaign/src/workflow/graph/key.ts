import { Data, Effect, Option } from 'effect'

declare const WorkflowKeyType: unique symbol

export class WorkflowKey<A> {
  declare readonly [WorkflowKeyType]: A

  constructor(readonly id: string) {}
}

export const workflowKey = <A>(id: string): WorkflowKey<A> =>
  new WorkflowKey<A>(id)

export type WorkflowOutput<A> = {
  readonly key: WorkflowKey<A>
  readonly value: A
}

export const workflowOutput = <A>(
  key: WorkflowKey<A>,
  value: A
): WorkflowOutput<A> => ({ key, value })

export class MissingWorkflowOutputError extends Data.TaggedError(
  'MissingWorkflowOutputError'
)<{ readonly key: string }> {
  override get message() {
    return `Workflow output "${this.key}" is unavailable.`
  }
}

export class DuplicateWorkflowOutputError extends Data.TaggedError(
  'DuplicateWorkflowOutputError'
)<{ readonly key: string }> {
  override get message() {
    return `Workflow output "${this.key}" was produced more than once.`
  }
}

export class WorkflowOutputs {
  static empty = new WorkflowOutputs(new Map())

  static from(outputs: readonly WorkflowOutput<unknown>[]) {
    return WorkflowOutputs.empty.addAll(outputs)
  }

  private constructor(
    private readonly values: ReadonlyMap<
      string,
      {
        readonly key: WorkflowKey<unknown>
        readonly value: unknown
      }
    >
  ) {}

  get<A>(key: WorkflowKey<A>): Effect.Effect<A, MissingWorkflowOutputError> {
    return Option.match(this.getOption(key), {
      onNone: () =>
        Effect.fail(new MissingWorkflowOutputError({ key: key.id })),
      onSome: Effect.succeed,
    })
  }

  getOption<A>(key: WorkflowKey<A>): Option.Option<A> {
    const stored = this.values.get(key.id)

    if (!stored || stored.key !== key) {
      return Option.none()
    }

    // Object identity proves this is the exact typed key used when the value
    // entered the store. Equal display ids alone are intentionally insufficient.
    return Option.some(stored.value as A)
  }

  has(key: WorkflowKey<unknown>) {
    return this.values.get(key.id)?.key === key
  }

  addAll(
    outputs: readonly WorkflowOutput<unknown>[]
  ): Effect.Effect<WorkflowOutputs, DuplicateWorkflowOutputError> {
    const next = new Map(this.values)

    for (const output of outputs) {
      if (next.has(output.key.id)) {
        return Effect.fail(
          new DuplicateWorkflowOutputError({ key: output.key.id })
        )
      }
      next.set(output.key.id, { key: output.key, value: output.value })
    }

    return Effect.succeed(new WorkflowOutputs(next))
  }
}
