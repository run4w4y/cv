import type { FieldRuntime, SortRuntime } from '../../fields/index'
import { invalidOrdering } from '../errors'
import type {
  EffectiveOrderTerm,
  OrderingErrorKind,
  OrderRequest,
  ResolvedOrderTerm,
} from '../types'

/** @internal Validates and resolves explicit request or default terms. */
export const parseTerms = <FieldName extends string>(
  input: readonly OrderRequest<FieldName>[],
  fields: ReadonlyMap<string, FieldRuntime>,
  source: 'request' | 'default'
): readonly ResolvedOrderTerm<FieldName>[] => {
  const kind: OrderingErrorKind =
    source === 'default' ? 'definition' : 'request'
  const rootPath = source === 'default' ? 'defaultOrderBy' : 'orderBy'

  const seen = new Set<string>()
  return input.map((inputTerm, index) => {
    const path = `${rootPath}[${index}]`
    if (seen.has(inputTerm.field)) {
      throw invalidOrdering(
        `Ordering field "${inputTerm.field}" is used more than once.`,
        `${path}.field`,
        kind
      )
    }
    seen.add(inputTerm.field)

    const field = fields.get(inputTerm.field)
    if (field?.sort === undefined || !field.sort.enabled) {
      throw invalidOrdering(
        `Unknown or non-sortable field "${inputTerm.field}".`,
        `${path}.field`,
        kind
      )
    }

    return {
      public: {
        field: inputTerm.field as FieldName,
        direction: inputTerm.direction ?? 'asc',
        nulls: field.sort.nullable
          ? (inputTerm.nulls ?? field.sort.defaultNulls)
          : field.sort.defaultNulls,
        unique: field.sort.unique,
        nullable: field.sort.nullable,
        source,
      },
      sort: field.sort,
    }
  })
}

/** @internal Rebinds resolved public terms to a concrete field registry. */
export const bindOrderingTerms = <FieldName extends string>(
  fields: ReadonlyMap<string, FieldRuntime>,
  terms: readonly EffectiveOrderTerm<FieldName>[]
): readonly ResolvedOrderTerm<FieldName>[] =>
  terms.map((term) => {
    const sort = fields.get(term.field)?.sort
    if (sort === undefined || !sort.enabled) {
      throw invalidOrdering(
        `Unknown or non-sortable field "${term.field}" while binding query ordering.`,
        `fields.${term.field}`,
        'definition'
      )
    }
    return { public: term, sort }
  })

/** @internal Resolves a fallback or deterministic tie-breaker tuple. */
export const implicitCandidate = <FieldName extends string>(
  candidate: readonly FieldName[],
  fields: ReadonlyMap<string, FieldRuntime>,
  source: 'fallback' | 'tie-breaker'
): readonly ResolvedOrderTerm<FieldName>[] =>
  candidate.map((fieldName) => {
    const sort = fields.get(fieldName)?.sort
    if (sort === undefined || !sort.enabled) {
      throw invalidOrdering(
        `Unknown or non-sortable unique field "${fieldName}".`,
        'uniqueBy',
        'definition'
      )
    }
    return implicitTerm<FieldName>(fieldName, sort, source)
  })

const implicitTerm = <FieldName extends string>(
  field: string,
  sort: SortRuntime,
  source: 'fallback' | 'tie-breaker'
): ResolvedOrderTerm<FieldName> => ({
  public: {
    field: field as FieldName,
    direction: 'asc',
    nulls: sort.defaultNulls,
    unique: sort.unique,
    nullable: sort.nullable,
    source,
  },
  sort,
})
