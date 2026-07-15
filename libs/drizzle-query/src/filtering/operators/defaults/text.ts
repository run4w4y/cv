import { type SQL, type SQLWrapper, sql } from 'drizzle-orm'

import { binaryFilterOperator } from '../define'
import type {
  BinaryFilterOperatorCompileArguments,
  FilterValueBinder,
} from '../types'
import { equalityOperators } from './shared'
import type { TextOperators } from './types'

export const escapeLikeLiteral = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')

const likeExpression = (
  expression: SQLWrapper,
  pattern: string,
  bind: FilterValueBinder,
  negated: boolean
): SQL => {
  const escapedPattern = bind(pattern)
  const escapeCharacter = sql.param('\\')
  return negated
    ? sql`${expression} not like ${escapedPattern} escape ${escapeCharacter}`
    : sql`${expression} like ${escapedPattern} escape ${escapeCharacter}`
}

/** Creates the default equality, list, and literal-pattern text operators. */
export const textOperators = <
  Value extends string = string,
>(): TextOperators<Value> => {
  const equality = equalityOperators<Value>()
  return [
    ...equality,
    binaryFilterOperator('contains', {
      compile: ({
        expression,
        value,
        bind,
      }: BinaryFilterOperatorCompileArguments<Value>) =>
        likeExpression(
          expression,
          `%${escapeLikeLiteral(value)}%`,
          bind,
          false
        ),
    }),
    binaryFilterOperator('notContains', {
      compile: ({
        expression,
        value,
        bind,
      }: BinaryFilterOperatorCompileArguments<Value>) =>
        likeExpression(expression, `%${escapeLikeLiteral(value)}%`, bind, true),
    }),
    binaryFilterOperator('startsWith', {
      compile: ({
        expression,
        value,
        bind,
      }: BinaryFilterOperatorCompileArguments<Value>) =>
        likeExpression(expression, `${escapeLikeLiteral(value)}%`, bind, false),
    }),
    binaryFilterOperator('endsWith', {
      compile: ({
        expression,
        value,
        bind,
      }: BinaryFilterOperatorCompileArguments<Value>) =>
        likeExpression(expression, `%${escapeLikeLiteral(value)}`, bind, false),
    }),
  ]
}
