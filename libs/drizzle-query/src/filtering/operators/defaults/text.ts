import { type SQL, type SQLWrapper, sql } from 'drizzle-orm'

import { binaryFilterOperator } from '../define'
import type {
  BinaryFilterOperatorCompileArguments,
  FilterValueBinder,
} from '../types'
import { equalityOperators } from './shared'
import type { TextOperators } from './types'

const escapeLikeLiteral = (value: string, escapeCharacter: string): string =>
  value
    .replaceAll(escapeCharacter, `${escapeCharacter}${escapeCharacter}`)
    .replaceAll('%', `${escapeCharacter}%`)
    .replaceAll('_', `${escapeCharacter}_`)

// `!` has identical LIKE escaping semantics without relying on a dialect's
// treatment of backslashes inside SQL string literals.
const likeEscapeCharacter = '!'
const inlineLikeEscapeCharacter = sql`${likeEscapeCharacter}`.inlineParams()

const likeExpression = (
  expression: SQLWrapper,
  pattern: string,
  bind: FilterValueBinder,
  negated: boolean
): SQL => {
  const escapedPattern = bind(pattern)
  return negated
    ? sql`${expression} not like ${escapedPattern} escape ${inlineLikeEscapeCharacter}`
    : sql`${expression} like ${escapedPattern} escape ${inlineLikeEscapeCharacter}`
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
          `%${escapeLikeLiteral(value, likeEscapeCharacter)}%`,
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
        likeExpression(
          expression,
          `%${escapeLikeLiteral(value, likeEscapeCharacter)}%`,
          bind,
          true
        ),
    }),
    binaryFilterOperator('startsWith', {
      compile: ({
        expression,
        value,
        bind,
      }: BinaryFilterOperatorCompileArguments<Value>) =>
        likeExpression(
          expression,
          `${escapeLikeLiteral(value, likeEscapeCharacter)}%`,
          bind,
          false
        ),
    }),
    binaryFilterOperator('endsWith', {
      compile: ({
        expression,
        value,
        bind,
      }: BinaryFilterOperatorCompileArguments<Value>) =>
        likeExpression(
          expression,
          `%${escapeLikeLiteral(value, likeEscapeCharacter)}`,
          bind,
          false
        ),
    }),
  ]
}
