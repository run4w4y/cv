import type {
  AnyColumn,
  GetColumnData,
  SQL,
  SQLWrapper,
  Table,
} from 'drizzle-orm'

import type {
  BinaryFilterOperator,
  FilterValueDescriptor,
  UnaryFilterOperator,
} from '../../filtering/operators/index'
import type { CountQueryField, QueryField } from '../query-field'

/** Default operators inferred for a many-valued relationship. */
export type ManyRelationOperators<Value> = readonly [
  BinaryFilterOperator<'hasAny', readonly Value[]>,
  BinaryFilterOperator<'hasAll', readonly Value[]>,
  BinaryFilterOperator<'hasNone', readonly Value[]>,
  UnaryFilterOperator<'isEmpty'>,
  UnaryFilterOperator<'isNotEmpty'>,
]

/** Correlated SQL helpers provided when customizing relation operators. */
export type ManyRelationFilterTools = {
  /** Related value expression selected by the relation definition. */
  readonly value: SQLWrapper
  /** Builds a correlated `exists` predicate with an optional value predicate. */
  readonly exists: (predicate?: SQLWrapper) => SQL
  /** Builds the negation of the corresponding correlated `exists` predicate. */
  readonly notExists: (predicate?: SQLWrapper) => SQL
}

type RelatedValue<Expression extends AnyColumn | SQL> =
  Expression extends AnyColumn
    ? GetColumnData<Expression, 'raw'>
    : Expression extends SQL<infer Value>
      ? Value
      : never

type ManyRelationDefinition<
  Root extends Table,
  Related extends Table,
  Expression,
> = {
  readonly on: (context: {
    readonly root: Root['_']['columns']
    readonly related: Related['_']['columns']
  }) => SQLWrapper
  readonly value: (context: {
    readonly related: Related['_']['columns']
  }) => Expression
}

type RelationBinding<Expression extends AnyColumn | SQL> =
  Expression extends AnyColumn
    ? { readonly bind?: never }
    : {
        /** Encodes a logical value for comparison with a computed SQL expression. */
        readonly bind: (value: RelatedValue<Expression>) => SQLWrapper
        /** Runtime value description used by schema adapters. */
        readonly filterValue?: FilterValueDescriptor
      }

/**
 * Correlation and related-value expressions for a many-valued relationship.
 * Columns use their Drizzle encoder automatically; computed expressions require
 * an explicit `bind` function so their logical value remains strongly typed.
 */
export type ManyRelationOptions<
  Root extends Table,
  Related extends Table,
  Expression extends AnyColumn | SQL = AnyColumn | SQL,
> = Expression extends AnyColumn
  ? ManyRelationDefinition<Root, Related, Expression> &
      RelationBinding<Expression>
  : Expression extends SQL
    ? ManyRelationDefinition<Root, Related, Expression> &
        RelationBinding<Expression>
    : never

/** @internal Column-valued relation definition. */
export type ManyRelationColumnOptions<
  Root extends Table,
  Related extends Table,
  ColumnType extends AnyColumn,
> = ManyRelationOptions<Root, Related, ColumnType>

/** @internal Expression-valued relation definition. */
export type ManyRelationExpressionOptions<
  Root extends Table,
  Related extends Table,
  Value,
> = ManyRelationDefinition<Root, Related, SQL<Value>> & {
  readonly bind: (value: Value) => SQLWrapper
  readonly filterValue?: FilterValueDescriptor
}

/** @internal Erased relation definition used by the runtime factory. */
export type ManyRelationRuntimeOptions<
  Root extends Table,
  Related extends Table,
  Value,
> = ManyRelationDefinition<Root, Related, AnyColumn | SQL> & {
  readonly bind?: (value: Value) => SQLWrapper
  readonly filterValue?: FilterValueDescriptor
}

/** Query-field builder representing a correlated related-value collection. */
export type ManyRelationField<Value> = QueryField<
  never,
  readonly Value[],
  false,
  ManyRelationOperators<Value>,
  undefined,
  false,
  ManyRelationFilterTools,
  'none',
  () => CountQueryField,
  'relation'
>

/** @internal Overloads exposed by the bound many-relation factory. */
export type ManyRelationFactory<Root extends Table> = {
  <Related extends Table, ColumnType extends AnyColumn>(
    related: Related,
    options: ManyRelationColumnOptions<Root, Related, ColumnType>
  ): ManyRelationField<GetColumnData<ColumnType, 'raw'>>
  <Related extends Table, Value>(
    related: Related,
    options: ManyRelationExpressionOptions<Root, Related, Value>
  ): ManyRelationField<Value>
}

/** Relationship constructors available as `rel` in {@link defineQuery}. */
export type RelationHelpers<Root extends Table> = {
  /** Declares a correlated collection relation rooted at the query table. */
  readonly many: ManyRelationFactory<Root>
}
