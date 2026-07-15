import type { SQL, Table } from 'drizzle-orm'

import type {
  AnyQueryField,
  FieldNameOf,
  FieldOriginOf,
  FieldResultOf,
} from '../../fields/index'
import type { QueryFieldBinding } from '../../query/binding'
import type { RenderedQuery } from '../sql'

type ExpressionField<Field> = Field extends AnyQueryField
  ? FieldOriginOf<Field> extends 'expression'
    ? Field
    : never
  : never

/** Public names of expression-backed fields that an RQB query can select. */
export type SelectableExpressionName<Fields extends readonly AnyQueryField[]> =
  FieldNameOf<ExpressionField<Fields[number]>>

type FieldNamed<Field, Name extends string> = Field extends AnyQueryField
  ? FieldNameOf<Field> extends Name
    ? Field
    : never
  : never

/** @internal Public computed extras selected by a relational query view. */
export type SelectedExpressionExtras<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
  Selected extends readonly SelectableExpressionName<Fields>[],
> = {
  readonly [Name in Selected[number]]: (
    root: TTable
  ) => SQL<FieldResultOf<FieldNamed<Fields[number], Name>>>
}

/**
 * Package-owned portion of a Drizzle relational `findMany` config.
 *
 * Cursor pagination may attach additional private extras at runtime. Their
 * names are intentionally absent from this public type and matching
 * {@link RelationalQueryView.finalize} removes them from returned items.
 */
export type RelationalQueryConfig<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
  Selected extends readonly SelectableExpressionName<Fields>[],
> = {
  readonly where?: {
    readonly RAW: (root: TTable) => SQL
  }
  readonly orderBy: (root: TTable) => SQL[]
  readonly limit: number
  readonly offset?: number
  readonly extras: SelectedExpressionExtras<TTable, Fields, Selected>
}

/** @internal Lazy binding and SQL-lowering services owned by a resolved query. */
export type RelationalRenderer<
  Fields extends readonly AnyQueryField[],
  FieldName extends string,
  Kind extends string,
> = {
  readonly bind: (table: Table) => QueryFieldBinding<Fields>
  readonly render: (table: Table) => RenderedQuery<FieldName, Kind>
  readonly canReuseCursorValue: (field: FieldName) => boolean
}
