import { and, type SQLWrapper, sql } from 'drizzle-orm'
import { uniqWith } from 'es-toolkit'

import {
  type BinaryFilterOperatorCompileArguments,
  binaryFilterOperator,
  unaryFilterOperator,
} from '../../filtering/operators/index'
import type { ManyRelationFilterTools, ManyRelationOperators } from './types'

const sameValue = (left: unknown, right: unknown): boolean =>
  left instanceof Date && right instanceof Date
    ? left.getTime() === right.getTime()
    : Object.is(left, right)

const uniqueValues = <Value>(values: readonly Value[]): readonly Value[] =>
  uniqWith(values, sameValue)

/** @internal Creates the inferred operators for one relation binding. */
export const makeRelationOperators = <Value>(
  tools: ManyRelationFilterTools,
  bind: (value: Value) => SQLWrapper
): ManyRelationOperators<Value> => [
  binaryFilterOperator('hasAny', {
    valueShape: 'array',
    compile: ({
      value,
    }: BinaryFilterOperatorCompileArguments<readonly Value[]>) => {
      if (value.length === 0) return sql`1 = 0`
      const values = sql.join(
        value.map((item) => sql`${bind(item)}`),
        sql`, `
      )
      return tools.exists(sql`${tools.value} in (${values})`)
    },
  }),
  binaryFilterOperator('hasAll', {
    valueShape: 'array',
    compile: ({
      value,
    }: BinaryFilterOperatorCompileArguments<readonly Value[]>) =>
      and(
        ...uniqueValues(value).map((item) =>
          tools.exists(sql`${tools.value} = ${bind(item)}`)
        )
      ) ?? sql`1 = 1`,
  }),
  binaryFilterOperator('hasNone', {
    valueShape: 'array',
    compile: ({
      value,
    }: BinaryFilterOperatorCompileArguments<readonly Value[]>) => {
      if (value.length === 0) return sql`1 = 1`
      const values = sql.join(
        value.map((item) => sql`${bind(item)}`),
        sql`, `
      )
      return tools.notExists(sql`${tools.value} in (${values})`)
    },
  }),
  unaryFilterOperator('isEmpty', {
    compile: () => tools.notExists(),
  }),
  unaryFilterOperator('isNotEmpty', {
    compile: () => tools.exists(),
  }),
]
