import type { OrderRequest } from '../ordering/types'
import {
  formatQueryLanguageIdentifier,
  makeQueryLanguageScanner,
  parseQueryLanguageIdentifier,
} from './literals'
import {
  type QueryLanguageResult,
  queryLanguageFailure,
  queryLanguageSuccess,
} from './types'

export const maxCompactSortLength = 16 * 1024
export const maxCompactSortTerms = 32

/** Parses compact-v1 ordering syntax without validating definition field names. */
export const parseSortExpression = (
  input: string
): QueryLanguageResult<readonly OrderRequest[]> => {
  if (input.length === 0) {
    return queryLanguageFailure({
      code: 'empty-expression',
      message: 'A sort expression cannot be empty.',
      offset: 0,
    })
  }
  if (input.length > maxCompactSortLength) {
    return queryLanguageFailure({
      code: 'expression-too-large',
      message: `A sort expression may contain at most ${maxCompactSortLength} characters.`,
      offset: maxCompactSortLength,
    })
  }

  const scanner = makeQueryLanguageScanner(input)
  const terms: OrderRequest[] = []
  const fields = new Set<string>()
  while (scanner.index < scanner.input.length) {
    if (terms.length >= maxCompactSortTerms) {
      return queryLanguageFailure(
        scanner.issue({
          code: 'too-many-sort-terms',
          message: `A sort expression may contain at most ${maxCompactSortTerms} terms.`,
        })
      )
    }
    const field = parseQueryLanguageIdentifier(scanner)
    if (!field.ok) return field
    if (fields.has(field.value)) {
      return queryLanguageFailure(
        scanner.issue({
          code: 'duplicate-sort-field',
          message: `Sort field "${field.value}" may appear only once.`,
        })
      )
    }
    fields.add(field.value)
    scanner.skipWhitespace()
    if (scanner.input[scanner.index] !== ':') {
      return queryLanguageFailure(
        scanner.issue({
          code: 'expected-token',
          message: 'Expected ":" after the sort field.',
        })
      )
    }
    scanner.index += 1
    const direction = parseQueryLanguageIdentifier(scanner)
    if (!direction.ok) return direction
    if (direction.value !== 'asc' && direction.value !== 'desc') {
      return queryLanguageFailure({
        code: 'invalid-sort-direction',
        message: 'Sort direction must be "asc" or "desc".',
        offset: scanner.index - direction.value.length,
      })
    }

    scanner.skipWhitespace()
    let nulls: 'first' | 'last' | undefined
    if (scanner.input[scanner.index] === ':') {
      scanner.index += 1
      const placement = parseQueryLanguageIdentifier(scanner)
      if (!placement.ok) return placement
      if (placement.value !== 'first' && placement.value !== 'last') {
        return queryLanguageFailure({
          code: 'invalid-sort-null-placement',
          message: 'Null placement must be "first" or "last".',
          offset: scanner.index - placement.value.length,
        })
      }
      nulls = placement.value
    }
    terms.push({
      field: field.value,
      direction: direction.value,
      ...(nulls === undefined ? {} : { nulls }),
    })

    scanner.skipWhitespace()
    if (scanner.index === scanner.input.length) break
    if (scanner.input[scanner.index] !== ',') {
      return queryLanguageFailure(
        scanner.issue({
          code: 'unexpected-token',
          message: 'Expected "," between sort terms.',
        })
      )
    }
    scanner.index += 1
    scanner.skipWhitespace()
    if (scanner.index === scanner.input.length) {
      return queryLanguageFailure(
        scanner.issue({
          code: 'expected-token',
          message: 'Expected a sort term after ",".',
        })
      )
    }
  }
  return queryLanguageSuccess(terms)
}

/** Formats ordering IR using one deterministic compact-v1 representation. */
export const formatSortExpression = (
  terms: readonly OrderRequest[]
): QueryLanguageResult<string | undefined> => {
  if (terms.length === 0) return queryLanguageSuccess(undefined)
  if (terms.length > maxCompactSortTerms) {
    return queryLanguageFailure({
      code: 'too-many-sort-terms',
      message: `A sort expression may contain at most ${maxCompactSortTerms} terms.`,
    })
  }
  const fields = new Set<string>()
  const formatted: string[] = []
  for (const term of terms) {
    if (
      term.direction !== undefined &&
      term.direction !== 'asc' &&
      term.direction !== 'desc'
    ) {
      return queryLanguageFailure({
        code: 'invalid-sort-direction',
        message: 'Sort direction must be "asc" or "desc".',
      })
    }
    if (
      term.nulls !== undefined &&
      term.nulls !== 'first' &&
      term.nulls !== 'last'
    ) {
      return queryLanguageFailure({
        code: 'invalid-sort-null-placement',
        message: 'Null placement must be "first" or "last".',
      })
    }
    if (fields.has(term.field)) {
      return queryLanguageFailure({
        code: 'duplicate-sort-field',
        message: `Sort field "${term.field}" may appear only once.`,
      })
    }
    fields.add(term.field)
    formatted.push(
      `${formatQueryLanguageIdentifier(term.field)}:${term.direction ?? 'asc'}${
        term.nulls === undefined ? '' : `:${term.nulls}`
      }`
    )
  }
  const expression = formatted.join(',')
  return expression.length > maxCompactSortLength
    ? queryLanguageFailure({
        code: 'expression-too-large',
        message: `A sort expression may contain at most ${maxCompactSortLength} characters.`,
      })
    : queryLanguageSuccess(expression)
}
