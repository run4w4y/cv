import {
  and,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import type { CursorSeekTerm } from './types'

const falseCondition = (): SQL => sql`(1 = 0)`

const boundCursorValue = (term: CursorSeekTerm): unknown => {
  if (term.value === null) {
    return undefined
  }

  return term.encode?.(term.value) ?? term.value
}

const equalToCursorValue = (term: CursorSeekTerm, value: unknown): SQL => {
  if (term.value === null) {
    return isNull(term.expression)
  }

  return eq(term.expression, value)
}

const afterCursorValue = (
  term: CursorSeekTerm,
  value: unknown
): SQL | undefined => {
  if (term.value === null) {
    return term.nulls === 'first' ? isNotNull(term.expression) : undefined
  }

  const comparison =
    term.direction === 'asc'
      ? gt(term.expression, value)
      : lt(term.expression, value)

  return term.nullable && term.nulls === 'last'
    ? (or(comparison, isNull(term.expression)) ?? comparison)
    : comparison
}

/**
 * Builds the row-value-independent lexicographic `after` predicate used by
 * cursor pagination. `undefined` means that no ordering terms were supplied;
 * a valid tuple with no possible successor produces an explicit false SQL
 * predicate instead.
 */
export const buildCursorSeek = (
  terms: readonly CursorSeekTerm[]
): SQL | undefined => {
  if (terms.length === 0) {
    return undefined
  }

  const branches: SQL[] = []
  const prefix: SQL[] = []

  for (const term of terms) {
    const value = boundCursorValue(term)
    const after = afterCursorValue(term, value)

    if (after !== undefined) {
      branches.push(and(...prefix, after) ?? after)
    }

    prefix.push(equalToCursorValue(term, value))
  }

  return or(...branches) ?? falseCondition()
}
