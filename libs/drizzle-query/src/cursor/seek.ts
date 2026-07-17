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
    return isNull(term.nullExpression)
  }

  return eq(term.expression, value)
}

const afterCursorValue = (
  term: CursorSeekTerm,
  value: unknown
): SQL | undefined => {
  if (term.value === null) {
    return term.nulls === 'first' ? isNotNull(term.nullExpression) : undefined
  }

  const comparison =
    term.direction === 'asc'
      ? gt(term.expression, value)
      : lt(term.expression, value)

  return term.nullable && term.nulls === 'last'
    ? (or(comparison, isNull(term.nullExpression)) ?? comparison)
    : comparison
}

const nestedSeek = (
  terms: readonly CursorSeekTerm[],
  index: number
): SQL | undefined => {
  const term = terms[index]
  if (term === undefined) return undefined

  const value = boundCursorValue(term)
  const after = afterCursorValue(term, value)
  const suffix = nestedSeek(terms, index + 1)
  const equalSuffix =
    suffix === undefined
      ? undefined
      : (and(equalToCursorValue(term, value), suffix) ?? suffix)

  if (after === undefined) return equalSuffix
  if (equalSuffix === undefined) return after
  return or(after, equalSuffix) ?? after
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

  return nestedSeek(terms, 0) ?? falseCondition()
}
