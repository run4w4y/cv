import { and, type SQL, type SQLWrapper } from 'drizzle-orm'

import type { EffectiveOrderTerm } from '../ordering/index'
import type { PaginationPageInfo } from '../pagination/index'
import type { QueryRequestIr } from '../query/ir'
import {
  type CursorExtraKey,
  type FinalizedPage,
  finalizeRenderedRows,
  nestedCursorReader,
  QUERY_METADATA_KEY,
  stripNestedCursorMetadata,
} from './result'
import type {
  FilteringFragments,
  PaginationFragments,
  RenderedQuery,
} from './sql'

/** Dynamic Drizzle select operations used by {@link SelectQueryView.apply}. */
export interface DynamicSelectBuilder {
  where(condition: SQL | undefined): this
  orderBy(...expressions: SQL[]): this
  limit(limit: number): this
  offset(offset: number): this
}

/** Hidden nested selection required to encode the next cursor. */
export type RequiredSelection = Readonly<
  Record<
    string,
    SQL.Aliased<unknown> | Readonly<Record<string, SQL.Aliased<unknown>>>
  >
>

/** Ordering fragments exposed by the ordinary select renderer. */
export type SelectOrderingFragments<FieldName extends string> = {
  readonly terms: readonly EffectiveOrderTerm<FieldName>[]
  readonly orderBy: readonly SQL[]
  readonly cursorAliases: readonly CursorExtraKey[]
  readonly requiredSelection: RequiredSelection
}

/** Ordinary-select page type with private metadata omitted statically. */
export type FinalizedSelectPage<Row, Info> = FinalizedPage<
  Omit<Row, typeof QUERY_METADATA_KEY>,
  Info
>

/**
 * Lazy target view for ordinary Drizzle `$dynamic()` select builders.
 * It owns only clause application and the nested cursor projection.
 */
export class SelectQueryView<
  FieldName extends string,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string,
> {
  readonly #ir: QueryRequestIr<FieldName, Info, Kind, unknown>
  readonly #rendered: RenderedQuery<FieldName, Kind>
  readonly #ordering: SelectOrderingFragments<FieldName>

  /** @internal Created by a resolved query's select renderer. */
  constructor(
    ir: QueryRequestIr<FieldName, Info, Kind, unknown>,
    rendered: RenderedQuery<FieldName, Kind>
  ) {
    this.#ir = ir
    this.#rendered = rendered
    const cursorAliases = rendered.ordering.cursorProjections.map(
      ({ alias }) => alias
    )
    const cursorSelection = Object.fromEntries(
      rendered.ordering.cursorProjections.map(({ alias, selection }) => [
        alias,
        selection,
      ])
    )
    this.#ordering = {
      terms: rendered.ordering.terms,
      orderBy: rendered.ordering.orderBy,
      cursorAliases,
      requiredSelection:
        cursorAliases.length === 0
          ? {}
          : { [QUERY_METADATA_KEY]: cursorSelection },
    }
  }

  /** Filtering-specific SQL fragments. */
  get filtering(): FilteringFragments {
    return this.#rendered.filtering
  }

  /** Deterministic ordering and its private cursor selection. */
  get ordering(): SelectOrderingFragments<FieldName> {
    return this.#ordering
  }

  /** Pagination SQL and execution bounds. */
  get pagination(): PaginationFragments<Kind> {
    return this.#rendered.pagination
  }

  /** Complete predicate combining filters and cursor seek conditions. */
  get where(): SQL | undefined {
    return this.#rendered.where
  }

  /** Hidden selection to spread into a cursor-paginated select. */
  get requiredSelection(): RequiredSelection {
    return this.#ordering.requiredSelection
  }

  /** Applies all package-owned clauses while retaining the exact builder type. */
  apply<Builder extends DynamicSelectBuilder>(
    builder: Builder,
    options: { readonly where?: SQLWrapper } = {}
  ): Builder {
    const filtered = builder.where(and(options.where, this.#rendered.where))
    const ordered = filtered.orderBy(...this.#ordering.orderBy)
    const limited = ordered.limit(this.#rendered.pagination.limit)

    return this.#rendered.pagination.offset === undefined
      ? limited
      : limited.offset(this.#rendered.pagination.offset)
  }

  /** Finalizes look-ahead rows and removes the nested cursor projection. */
  finalize<Row>(
    rows: readonly Row[],
    totalItems?: number
  ): FinalizedSelectPage<Row, Info> {
    const aliases = this.#ordering.cursorAliases
    const page = finalizeRenderedRows(
      this.#ir,
      rows,
      totalItems,
      aliases.length === 0 ? undefined : nestedCursorReader(aliases),
      stripNestedCursorMetadata
    )
    return page as FinalizedSelectPage<Row, Info>
  }
}
