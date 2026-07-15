import type {
  AppendOperators,
  NormalizeOperators,
  PickOperators,
  ReplaceOperator,
  WithoutOperators,
} from './tuple-types'
import type { AnyFilterOperator, OperatorName } from './types'

/** Resolves duplicate names in favor of the last operator declaration. */
export const normalizeOperators = <
  const Operators extends readonly AnyFilterOperator[],
>(
  operators: Operators
): NormalizeOperators<Operators> => {
  const latest = new Map<string, number>()
  operators.forEach((operator, index) => {
    latest.set(operator.name, index)
  })
  return operators.filter(
    (operator, index) => latest.get(operator.name) === index
  ) as unknown as NormalizeOperators<Operators>
}

/** Keeps named operators while preserving their source order. */
export const pickOperators = <
  const Operators extends readonly AnyFilterOperator[],
  const Names extends readonly OperatorName<Operators[number]>[],
>(
  operators: Operators,
  names: Names
): PickOperators<Operators, Names> => {
  const requested = new Set<string>(names)
  return operators.filter((operator) =>
    requested.has(operator.name)
  ) as unknown as PickOperators<Operators, Names>
}

/** Removes named operators while preserving every remaining member. */
export const withoutOperators = <
  const Operators extends readonly AnyFilterOperator[],
  const Names extends readonly OperatorName<Operators[number]>[],
>(
  operators: Operators,
  names: Names
): WithoutOperators<Operators, Names> => {
  const omitted = new Set<string>(names)
  return operators.filter(
    (operator) => !omitted.has(operator.name)
  ) as unknown as WithoutOperators<Operators, Names>
}

/** Replaces an existing operator with one carrying the same name. */
export const replaceOperator = <
  const Operators extends readonly AnyFilterOperator[],
  const Replacement extends AnyFilterOperator & {
    readonly name: OperatorName<Operators[number]>
  },
>(
  operators: Operators,
  replacement: Replacement
): ReplaceOperator<Operators, Replacement> => {
  return operators.map((operator) =>
    operator.name === replacement.name ? replacement : operator
  ) as unknown as ReplaceOperator<Operators, Replacement>
}

/** Appends operators, allowing later declarations to override earlier names. */
export const appendOperators = <
  const Operators extends readonly AnyFilterOperator[],
  const Appended extends readonly AnyFilterOperator[],
>(
  operators: Operators,
  appended: Appended
): AppendOperators<Operators, Appended> => {
  return normalizeOperators([...operators, ...appended]) as AppendOperators<
    Operators,
    Appended
  >
}
