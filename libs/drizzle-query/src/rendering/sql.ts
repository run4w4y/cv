import { and, type SQL, type SQLWrapper } from 'drizzle-orm'
import { CURSOR_EXTRA_PREFIX } from '../cursor/constants'
import { buildCursorSeek } from '../cursor/index'
import type { FieldRuntime } from '../fields/index'
import { compileFilters } from '../filtering/index'
import type { EffectiveOrderTerm } from '../ordering/index'
import { bindOrderingTerms } from '../ordering/resolve'
import { explicitOrderBy } from '../ordering/sql-order'
import type { PaginationPageInfo } from '../pagination/index'
import type { QueryRequestIr } from '../query/ir'
import { countBoundParameters } from './parameter-count'

/** SQL produced for filtering against one bound table. */
export type FilteringFragments = {
  readonly where: SQL | undefined
}

/** One private cursor value that a target renderer must project. */
export type CursorProjection<FieldName extends string = string> = {
  readonly field: FieldName
  readonly alias: `${typeof CURSOR_EXTRA_PREFIX}${number}`
  readonly expression: SQLWrapper
  readonly selection: SQL.Aliased<unknown>
}

/** SQL ordering and cursor projection data for one bound table. */
export type OrderingFragments<Term, FieldName extends string = string> = {
  readonly terms: readonly Term[]
  readonly orderBy: readonly SQL[]
  readonly cursorProjections: readonly CursorProjection<FieldName>[]
}

/** SQL bounds produced for a concrete pagination target. */
export type PaginationFragments<Kind extends string = string> = {
  readonly kind: Kind
  readonly size: number
  readonly seekWhere: SQL | undefined
  readonly limit: number
  readonly offset: number | undefined
}

/** Complete SQL lowering of shared request IR for one table binding. */
export type RenderedQuery<FieldName extends string, Kind extends string> = {
  readonly filtering: FilteringFragments
  readonly ordering: OrderingFragments<EffectiveOrderTerm<FieldName>, FieldName>
  readonly pagination: PaginationFragments<Kind>
  readonly where: SQL | undefined
  /** Parameters introduced by package-owned predicates, ordering, and bounds. */
  readonly boundParameterCount: number
}

/** @internal Lowers shared request IR to SQL for one concrete field binding. */
export const renderQuerySql = <
  FieldName extends string,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string,
>(
  registry: ReadonlyMap<string, FieldRuntime>,
  ir: QueryRequestIr<FieldName, Info, Kind, unknown>
): RenderedQuery<FieldName, Kind> => {
  const filtering = compileFilters(registry, ir.filters, ir.operatorContext)
  const resolved = bindOrderingTerms(registry, ir.ordering)
  const orderBy = resolved.flatMap(explicitOrderBy)
  const cursorProjections = ir.cursorIdentity
    ? resolved.map((term, index) => {
        const alias = `${CURSOR_EXTRA_PREFIX}${index}` as const
        return {
          field: term.public.field,
          alias,
          expression: term.sort.expression,
          selection: term.sort.selection(alias),
        }
      })
    : []
  const values = ir.pagination.cursorValues
  const seekWhere =
    values === undefined
      ? undefined
      : buildCursorSeek(
          resolved.map((term, index) => ({
            expression: term.sort.expression,
            nullExpression: term.sort.nullExpression,
            direction: term.public.direction,
            nulls: term.public.nulls,
            nullable: term.public.nullable,
            value: values[index] ?? null,
            ...(term.sort.encode === undefined
              ? {}
              : { encode: term.sort.encode }),
          }))
        )

  const where = and(filtering.where, seekWhere)
  const boundParameterCount =
    countBoundParameters(
      where,
      ...orderBy,
      ...cursorProjections.map(({ selection }) => selection)
    ) +
    1 +
    (ir.pagination.offset === undefined ? 0 : 1)

  return {
    filtering,
    ordering: {
      terms: ir.ordering,
      orderBy,
      cursorProjections,
    },
    pagination: {
      kind: ir.pagination.kind,
      size: ir.pagination.size,
      seekWhere,
      limit: ir.pagination.limit,
      offset: ir.pagination.offset,
    },
    where,
    boundParameterCount,
  }
}
