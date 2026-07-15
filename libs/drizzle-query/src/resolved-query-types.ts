import type { Table } from 'drizzle-orm'

import type { AnyQueryField } from './fields/index'
import type { EffectiveOrderTerm } from './ordering/index'
import type { PaginationPageInfo } from './pagination/index'
import type { QueryBindings } from './query/binding'
import type { QueryRequestIr } from './query/ir'
import type { SelectOrderingFragments } from './rendering/select'

/** @internal Extracts the public field name carried by an ordering term. */
export type TermField<Term> =
  Term extends EffectiveOrderTerm<infer FieldName> ? FieldName : string

/** Ordering fragments exposed by the default select renderer. */
export type OrderingFragments<Term> = Omit<
  SelectOrderingFragments<TermField<Term>>,
  'terms'
> & {
  readonly terms: readonly Term[]
}

/** @internal Definition-owned values shared by every resolved request. */
export type ResolvedQueryState<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
> = {
  readonly table: TTable
  readonly bindings: QueryBindings<TTable, Fields>
}

/** @internal Inputs used to construct one resolved query facade. */
export type ResolvedQueryInput<
  Term,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string,
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
  CursorState = never,
> = {
  readonly state: ResolvedQueryState<TTable, Fields>
  readonly ir: QueryRequestIr<TermField<Term>, Info, Kind, CursorState>
}
