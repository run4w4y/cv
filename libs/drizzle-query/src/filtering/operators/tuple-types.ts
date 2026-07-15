import type { AnyFilterOperator, OperatorName } from './types'

type OperatorsNamed<Operator, Name extends string> = Operator extends {
  readonly name: infer OperatorName extends string
}
  ? OperatorName extends Name
    ? Operator
    : never
  : never

type ExcludeOperatorsNamed<Operator, Name extends string> = Operator extends {
  readonly name: infer OperatorName extends string
}
  ? OperatorName extends Name
    ? never
    : Operator
  : never

type PreserveNonEmpty<
  Source extends readonly unknown[],
  Item,
> = Source extends readonly [unknown, ...unknown[]]
  ? readonly [Item, ...Item[]]
  : readonly Item[]

/** Operator collection with duplicate names resolved at runtime. */
export type NormalizeOperators<Operators extends readonly AnyFilterOperator[]> =
  PreserveNonEmpty<Operators, Operators[number]>

/** Tuple type returned by {@link pickOperators}. */
export type PickOperators<
  Operators extends readonly AnyFilterOperator[],
  Names extends readonly string[],
> = readonly OperatorsNamed<Operators[number], Names[number]>[]

/** Tuple type returned by {@link withoutOperators}. */
export type WithoutOperators<
  Operators extends readonly AnyFilterOperator[],
  Names extends readonly string[],
> = readonly ExcludeOperatorsNamed<Operators[number], Names[number]>[]

/** Tuple type returned by {@link replaceOperator}. */
export type ReplaceOperator<
  Operators extends readonly AnyFilterOperator[],
  Replacement extends AnyFilterOperator,
> = PreserveNonEmpty<
  Operators,
  | ExcludeOperatorsNamed<Operators[number], OperatorName<Replacement>>
  | Replacement
>

/** Tuple type returned by {@link appendOperators}. */
export type AppendOperators<
  Operators extends readonly AnyFilterOperator[],
  Appended extends readonly AnyFilterOperator[],
> = PreserveNonEmpty<
  readonly [...Operators, ...Appended],
  Operators[number] | Appended[number]
>
