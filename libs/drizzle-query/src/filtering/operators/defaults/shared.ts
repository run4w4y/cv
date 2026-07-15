import { type SQL, type SQLWrapper, sql } from 'drizzle-orm'

import { binaryFilterOperator } from '../define'
import type {
  BinaryFilterOperatorCompileArguments,
  FilterValueBinder,
} from '../types'
import type { ComparisonOperators, EqualityOperators } from './types'

const inList = <Value>(
  expression: SQLWrapper,
  values: readonly Value[],
  bind: FilterValueBinder,
  negated: boolean
): SQL => {
  if (values.length === 0) {
    return negated ? sql`(1 = 1)` : sql`(1 = 0)`
  }
  const parameters = sql.join(
    values.map((value) => sql`${bind(value)}`),
    sql`, `
  )
  return negated
    ? sql`${expression} not in (${parameters})`
    : sql`${expression} in (${parameters})`
}

/** Shared equality/list defaults for a typed right-hand-side value. */
export const equalityOperators = <Value>(): EqualityOperators<Value> => [
  binaryFilterOperator('eq', {
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<Value>) =>
      sql`${expression} = ${bind(value)}`,
  }),
  binaryFilterOperator('ne', {
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<Value>) =>
      sql`${expression} <> ${bind(value)}`,
  }),
  binaryFilterOperator('in', {
    valueShape: 'array',
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<readonly Value[]>) =>
      inList(expression, value, bind, false),
  }),
  binaryFilterOperator('notIn', {
    valueShape: 'array',
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<readonly Value[]>) =>
      inList(expression, value, bind, true),
  }),
]

/** Shared range defaults for values with a database ordering. */
export const comparisonOperators = <Value>(): ComparisonOperators<Value> => [
  binaryFilterOperator('gt', {
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<Value>) =>
      sql`${expression} > ${bind(value)}`,
  }),
  binaryFilterOperator('gte', {
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<Value>) =>
      sql`${expression} >= ${bind(value)}`,
  }),
  binaryFilterOperator('lt', {
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<Value>) =>
      sql`${expression} < ${bind(value)}`,
  }),
  binaryFilterOperator('lte', {
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<Value>) =>
      sql`${expression} <= ${bind(value)}`,
  }),
  binaryFilterOperator('between', {
    valueShape: 'tuple',
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<readonly [Value, Value]>) =>
      sql`${expression} between ${bind(value[0])} and ${bind(value[1])}`,
  }),
  binaryFilterOperator('notBetween', {
    valueShape: 'tuple',
    compile: ({
      expression,
      value,
      bind,
    }: BinaryFilterOperatorCompileArguments<readonly [Value, Value]>) =>
      sql`${expression} not between ${bind(value[0])} and ${bind(value[1])}`,
  }),
]
