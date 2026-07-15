import { sql } from 'drizzle-orm'

import { binaryFilterOperator, unaryFilterOperator } from '../define'
import type { BinaryFilterOperatorCompileArguments } from '../types'
import { comparisonOperators, equalityOperators } from './shared'
import type {
  BigIntOperators,
  BooleanOperators,
  DateOperators,
  NullableOperators,
  NumberOperators,
} from './types'

/** Creates the default numeric filter operators. */
export const numberOperators = (): NumberOperators => [
  ...equalityOperators<number>(),
  ...comparisonOperators<number>(),
]

/** Creates the default operators for a date-like value type. */
export const dateOperators = <Value = Date>(): DateOperators<Value> => [
  ...equalityOperators<Value>(),
  ...comparisonOperators<Value>(),
]

/** Creates the default bigint filter operators. */
export const bigintOperators = (): BigIntOperators => [
  ...equalityOperators<bigint>(),
  ...comparisonOperators<bigint>(),
]

/** Creates the default boolean equality operators. */
export const booleanOperators = (): BooleanOperators => [
  binaryFilterOperator('eq', {
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<boolean>) =>
      sql`${expression} = ${bind(value)}`,
  }),
  binaryFilterOperator('ne', {
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<boolean>) =>
      sql`${expression} <> ${bind(value)}`,
  }),
]

/** Creates unary `isNull` and `isNotNull` operators. */
export const nullableOperators = (): NullableOperators => [
  unaryFilterOperator('isNull', {
    compile: ({ expression }) => sql`${expression} is null`,
  }),
  unaryFilterOperator('isNotNull', {
    compile: ({ expression }) => sql`${expression} is not null`,
  }),
]
