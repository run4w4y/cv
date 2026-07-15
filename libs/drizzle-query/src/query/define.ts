import type { Table } from 'drizzle-orm'

import type { AnyQueryField } from '../fields/index'
import { QueryDefinition } from './definition'
import type {
  AnyPagination,
  DefineQueryFields,
  DefineQueryOptions,
  QueryContext,
  ResolvedDefineQueryOptions,
  SortableFieldName,
} from './types'

type InferredSortableFieldName<Fields extends readonly AnyQueryField[]> =
  AnyQueryField extends Fields[number] ? string : SortableFieldName<Fields>

/**
 * Defines the fields, filtering, ordering, and pagination capabilities of one
 * Drizzle list query. Request types are inferred from the returned field tuple.
 *
 * Consumers are responsible for decoding and validating transport input before
 * passing the resulting typed request to the definition.
 */
export const defineQuery = <
  TTable extends Table,
  const Fields extends readonly [AnyQueryField, ...AnyQueryField[]],
  const Pagination extends AnyPagination,
  CursorState = never,
>(
  table: TTable,
  defineFields: DefineQueryFields<TTable, Fields>,
  options: DefineQueryOptions<
    Pagination,
    InferredSortableFieldName<Fields>,
    CursorState,
    QueryContext<Fields>
  >
): QueryDefinition<TTable, Fields, Pagination, CursorState> =>
  new QueryDefinition<TTable, Fields, Pagination, CursorState>(
    table,
    defineFields,
    options as ResolvedDefineQueryOptions<Fields, Pagination, CursorState>
  )
