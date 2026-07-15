import type { BinaryFilterOperator, UnaryFilterOperator } from '../types'

/** Equality and list-membership operators for a typed value. */
export type EqualityOperators<Value> = readonly [
  BinaryFilterOperator<'eq', Value>,
  BinaryFilterOperator<'ne', Value>,
  BinaryFilterOperator<'in', readonly Value[]>,
  BinaryFilterOperator<'notIn', readonly Value[]>,
]

/** Ordered comparison and range operators for a typed value. */
export type ComparisonOperators<Value> = readonly [
  BinaryFilterOperator<'gt', Value>,
  BinaryFilterOperator<'gte', Value>,
  BinaryFilterOperator<'lt', Value>,
  BinaryFilterOperator<'lte', Value>,
  BinaryFilterOperator<'between', readonly [Value, Value]>,
  BinaryFilterOperator<'notBetween', readonly [Value, Value]>,
]

/** Equality and escaped pattern-matching operators for text values. */
export type TextOperators<Value extends string = string> = readonly [
  ...EqualityOperators<Value>,
  BinaryFilterOperator<'contains', Value>,
  BinaryFilterOperator<'notContains', Value>,
  BinaryFilterOperator<'startsWith', Value>,
  BinaryFilterOperator<'endsWith', Value>,
]

/** Equality and list-membership operators for a string enum. */
export type EnumOperators<Value extends string = string> =
  EqualityOperators<Value>

/** Default equality and ordered-comparison operators for numbers. */
export type NumberOperators = readonly [
  ...EqualityOperators<number>,
  ...ComparisonOperators<number>,
]

/** Default equality and ordered-comparison operators for date-like values. */
export type DateOperators<Value = Date> = readonly [
  ...EqualityOperators<Value>,
  ...ComparisonOperators<Value>,
]

/** Default equality and ordered-comparison operators for bigints. */
export type BigIntOperators = readonly [
  ...EqualityOperators<bigint>,
  ...ComparisonOperators<bigint>,
]

/** Default equality operators for booleans. */
export type BooleanOperators = readonly [
  BinaryFilterOperator<'eq', boolean>,
  BinaryFilterOperator<'ne', boolean>,
]

/** Unary null tests that can be appended to a field's operators. */
export type NullableOperators = readonly [
  UnaryFilterOperator<'isNull'>,
  UnaryFilterOperator<'isNotNull'>,
]

/** Scalar categories used to infer a Drizzle column's default operators. */
export type DefaultOperatorKind =
  | 'text'
  | 'string'
  | 'enum'
  | 'number'
  | 'date'
  | 'bigint'
  | 'boolean'
  | 'custom'

type DefaultOperatorsForValue<
  Kind extends DefaultOperatorKind,
  Value,
> = Kind extends 'text'
  ? [Value] extends [string]
    ? TextOperators<Extract<Value, string>>
    : never
  : Kind extends 'string'
    ? [Value] extends [string]
      ? EqualityOperators<Extract<Value, string>>
      : never
    : Kind extends 'enum'
      ? [Value] extends [string]
        ? EnumOperators<Extract<Value, string>>
        : never
      : Kind extends 'number'
        ? NumberOperators
        : Kind extends 'date'
          ? DateOperators<Value>
          : Kind extends 'bigint'
            ? BigIntOperators
            : Kind extends 'boolean'
              ? BooleanOperators
              : readonly []

/** Default operator tuple for a scalar category, value, and nullability. */
export type DefaultOperators<
  Kind extends DefaultOperatorKind,
  Value,
  Nullable extends boolean = false,
> = Nullable extends true
  ? readonly [...DefaultOperatorsForValue<Kind, Value>, ...NullableOperators]
  : DefaultOperatorsForValue<Kind, Value>
