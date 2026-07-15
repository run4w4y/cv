import { minBy } from 'es-toolkit'

import { invalidOrdering } from './errors'
import {
  makeFieldMap,
  orderingCandidates,
  resolveUniqueBy,
} from './resolution/fields'
import {
  bindOrderingTerms as bindResolvedOrderingTerms,
  implicitCandidate,
  parseTerms,
} from './resolution/terms'
import type {
  EffectiveOrderTerm,
  OrderingErrorKind,
  OrderingFieldSource,
  OrderingResolution,
  OrderingResolutionOptions,
  OrderRequest,
  ResolvedOrderTerm,
} from './types'

export { resolveUniqueBy } from './resolution/fields'

/** @internal Rebinds resolved public terms to a concrete field registry. */
export const bindOrderingTerms = <FieldName extends string>(
  fieldsInput: OrderingFieldSource,
  terms: readonly EffectiveOrderTerm<FieldName>[]
): readonly ResolvedOrderTerm<FieldName>[] =>
  bindResolvedOrderingTerms(makeFieldMap(fieldsInput), terms)

/**
 * Resolves one ordering request without producing SQL.
 *
 * The result is stable across Drizzle aliases and can therefore live in the
 * shared request IR. Concrete expressions are rebound only while rendering.
 */
export const resolveOrdering = <const FieldName extends string>(
  fieldsInput: OrderingFieldSource,
  input: readonly OrderRequest<FieldName>[] | undefined,
  options: OrderingResolutionOptions<FieldName>
): OrderingResolution<FieldName> => {
  const fields = makeFieldMap(fieldsInput)
  const uniqueBy = resolveUniqueBy<FieldName>(fields, options.uniqueBy)
  const candidates = orderingCandidates(fields, uniqueBy)

  let resolved =
    input !== undefined && input.length > 0
      ? parseTerms<FieldName>(input, fields, 'request')
      : options.defaults !== undefined && options.defaults.length > 0
        ? parseTerms<FieldName>(options.defaults, fields, 'default')
        : undefined

  if (resolved === undefined) {
    const fallback = minBy(candidates, (candidate) => candidate.length)
    if (fallback === undefined) {
      const usesDefaults = options.defaults !== undefined
      throw invalidOrdering(
        'Ordering requires defaults or at least one unique, non-null sortable field.',
        usesDefaults ? 'defaultOrderBy' : 'orderBy',
        usesDefaults ? 'definition' : 'request'
      )
    }
    resolved = implicitCandidate(fallback, fields, 'fallback')
  }

  const orderedFields = new Set(resolved.map((term) => term.public.field))
  const deterministic = candidates.some((candidate) =>
    candidate.every((fieldName) => orderedFields.has(fieldName))
  )
  if (!deterministic) {
    const usesDefaults = resolved.some(
      (term) => term.public.source === 'default'
    )
    const path = usesDefaults ? 'defaultOrderBy' : 'orderBy'
    const kind: OrderingErrorKind = usesDefaults ? 'definition' : 'request'
    const tieBreaker = minBy(
      candidates.map((candidate) =>
        candidate.filter((fieldName) => !orderedFields.has(fieldName))
      ),
      (missing) => missing.length
    )
    if (tieBreaker === undefined) {
      throw invalidOrdering(
        'Ordering requires a unique, non-null sortable tie-breaker.',
        path,
        kind
      )
    }
    resolved = [
      ...resolved,
      ...implicitCandidate(tieBreaker, fields, 'tie-breaker'),
    ]
  }

  return { terms: resolved.map((term) => term.public) }
}
