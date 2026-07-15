import type { SQL, SQLWrapper, Table } from 'drizzle-orm'

import type { AnyQueryField } from './fields/index'
import type { PaginationPageInfo } from './pagination/index'
import type { QueryRequestIr } from './query/ir'
import {
  RelationalQueryView,
  type SelectableExpressionName,
} from './rendering/relational/index'
import {
  type DynamicSelectBuilder,
  type FinalizedSelectPage,
  type RequiredSelection,
  SelectQueryView,
} from './rendering/select'
import {
  type FilteringFragments,
  type PaginationFragments,
  type RenderedQuery,
  renderQuerySql,
} from './rendering/sql'
import type {
  OrderingFragments,
  ResolvedQueryInput,
  ResolvedQueryState,
  TermField,
} from './resolved-query-types'

export type { OrderingFragments } from './resolved-query-types'
export type {
  DynamicSelectBuilder,
  FilteringFragments,
  PaginationFragments,
  RequiredSelection,
}

/** Cursor state restored from or embedded into one continuation chain. */
export type ResolvedCursorState<State> = [State] extends [never]
  ? undefined
  : State

/**
 * One resolved query request with lazy renderers for ordinary selects and RQB.
 * Request resolution and cursor decoding happen once; SQL is cached per table
 * or relational-query alias.
 */
export class ResolvedQuery<
  Term,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string = string,
  TTable extends Table = Table,
  Fields extends readonly AnyQueryField[] = readonly AnyQueryField[],
  CursorState = never,
> {
  readonly #state: ResolvedQueryState<TTable, Fields>
  readonly #ir: QueryRequestIr<TermField<Term>, Info, Kind, CursorState>
  readonly #rendered = new WeakMap<
    Table,
    RenderedQuery<TermField<Term>, Kind>
  >()
  #select: SelectQueryView<TermField<Term>, Info, Kind> | undefined

  /** Creates a resolved query facade from definition-owned state and request IR. */
  constructor(
    input: ResolvedQueryInput<Term, Info, Kind, TTable, Fields, CursorState>
  ) {
    this.#state = input.state
    this.#ir = input.ir
  }

  /** Default renderer for ordinary Drizzle dynamic select builders. */
  get select(): SelectQueryView<TermField<Term>, Info, Kind> {
    this.#select ??= new SelectQueryView(
      this.#ir,
      this.#render(this.#state.table)
    )
    return this.#select
  }

  /** Filtering-specific fragments from the default select target. */
  get filtering(): FilteringFragments {
    return this.select.filtering
  }

  /** Ordering fragments from the default select target. */
  get ordering(): OrderingFragments<Term> {
    return this.select.ordering as OrderingFragments<Term>
  }

  /** Pagination fragments from the default select target. */
  get pagination(): PaginationFragments<Kind> {
    return this.select.pagination
  }

  /** Complete default-table predicate. */
  get where(): SQL | undefined {
    return this.select.where
  }

  /** Hidden nested selection required by the default select renderer. */
  get requiredSelection(): RequiredSelection {
    return this.select.requiredSelection
  }

  /** State restored from or embedded into this cursor continuation chain. */
  get cursorState(): ResolvedCursorState<CursorState> {
    return this.#ir.cursorState as ResolvedCursorState<CursorState>
  }

  /** Creates an RQB renderer without public computed-expression extras. */
  relational(): RelationalQueryView<
    TTable,
    Fields,
    TermField<Term>,
    Info,
    Kind,
    readonly []
  >

  /** Creates an RQB renderer with opt-in query-defined expression extras. */
  relational<
    const Selected extends readonly SelectableExpressionName<Fields>[],
  >(options: {
    readonly select: Selected
  }): RelationalQueryView<TTable, Fields, TermField<Term>, Info, Kind, Selected>

  relational<
    const Selected extends readonly SelectableExpressionName<Fields>[],
  >(options?: {
    readonly select: Selected
  }): RelationalQueryView<
    TTable,
    Fields,
    TermField<Term>,
    Info,
    Kind,
    Selected | readonly []
  > {
    const selected = options?.select ?? []
    return new RelationalQueryView(
      this.#ir,
      this.#relationalRenderer(),
      selected
    )
  }

  /** Applies the default select renderer while preserving the builder type. */
  apply<Builder extends DynamicSelectBuilder>(
    builder: Builder,
    options: { readonly where?: SQLWrapper } = {}
  ): Builder {
    return this.select.apply(builder, options)
  }

  /** Finalizes rows produced by the default select renderer. */
  finalize<Row>(
    rows: readonly Row[],
    totalItems?: number
  ): FinalizedSelectPage<Row, Info> {
    return this.select.finalize(rows, totalItems)
  }

  #render(table: Table): RenderedQuery<TermField<Term>, Kind> {
    const cached = this.#rendered.get(table)
    if (cached !== undefined) return cached

    const rendered = renderQuerySql(
      this.#state.bindings.for(table).registry,
      this.#ir
    )
    this.#rendered.set(table, rendered)
    return rendered
  }

  #relationalRenderer() {
    return {
      bind: (table: Table) => this.#state.bindings.for(table),
      render: (table: Table) => this.#render(table),
      canReuseCursorValue: (field: TermField<Term>) => {
        const runtime = this.#state.bindings.original.registry.get(field)
        return (
          runtime?.selection !== undefined &&
          runtime.sort?.expression === runtime.expression
        )
      },
    }
  }
}

export type {
  RelationalQueryConfig,
  RelationalQueryView,
  SelectableExpressionName,
} from './rendering/relational/index'
export type { SelectQueryView } from './rendering/select'
