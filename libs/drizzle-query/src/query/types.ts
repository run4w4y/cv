import type { Table } from 'drizzle-orm'
import type { CursorCodec, CursorStateCodec } from '../cursor/index'
import type {
  AnyQueryField,
  ColumnCatalog,
  ExpressionHelpers,
  FieldIsSortable,
  FieldNameOf,
  FieldOperatorsOf,
  RelationHelpers,
} from '../fields/index'
import type {
  FilterValueDescriptor,
  OperatorContext,
  TypedFilterNode,
} from '../filtering/index'
import type { EffectiveOrderTerm, OrderRequest } from '../ordering/index'
import type {
  PaginationImplementation,
  PaginationInfoOf,
  PaginationPageInfo,
  PaginationRequestOf,
} from '../pagination/index'
import type { ResolvedQuery } from '../resolved-query'

/** @internal Broad constraint shared by query-definition generics. */
export type AnyPagination = PaginationImplementation<
  unknown,
  PaginationPageInfo,
  string
>

type SortableField<Field> = Field extends AnyQueryField
  ? FieldIsSortable<Field> extends true
    ? FieldNameOf<Field>
    : never
  : never

/** Extracts the public names of sortable fields in a definition tuple. */
export type SortableFieldName<Fields extends readonly AnyQueryField[]> =
  SortableField<Fields[number]>

type FieldQueryContext<Field> = Field extends AnyQueryField
  ? FieldOperatorsOf<Field> extends infer Operators extends readonly unknown[]
    ? OperatorContext<Operators[number]>
    : never
  : never

type UnionToIntersection<Union> = (
  Union extends unknown
    ? (value: Union) => void
    : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never

/** Resolution context inferred from all contextual operators in a field tuple. */
export type QueryContext<Fields extends readonly AnyQueryField[]> = [
  FieldQueryContext<Fields[number]>,
] extends [never]
  ? never
  : UnionToIntersection<FieldQueryContext<Fields[number]>>

/** Typed filtering, ordering, and pagination request accepted by a definition. */
export type QueryRequest<
  Fields extends readonly AnyQueryField[],
  Pagination extends AnyPagination,
> = {
  /** Typed filter tree compiled into the query predicate. */
  readonly filters?: readonly TypedFilterNode<Fields>[]
  /** Requested ordering; a deterministic tie-breaker is added when needed. */
  readonly orderBy?: readonly OrderRequest<SortableFieldName<Fields>>[]
  /** Request understood by the selected pagination implementation. */
  readonly pagination?: PaginationRequestOf<Pagination>
}

type QueryContextOption<Context, CursorState> = [Context] extends [never]
  ? {
      /** Context-free definitions do not accept an operator context. */
      readonly context?: never
    }
  : [CursorState] extends [never]
    ? {
        /** Consumer-owned values supplied to contextual filter operators. */
        readonly context: Context
      }
    : {
        readonly context?: never
      }

/** Options that affect request resolution without becoming request fields. */
export type QueryResolveOptions<
  Context = never,
  CursorState = never,
> = QueryContextOption<Context, CursorState> & {
  /** State embedded in cursors created for the first page. */
  readonly cursor?: {
    readonly initialState?: CursorState
  }
  /**
   * Stable consumer-owned data included in cursor identity. Use this for
   * constraints such as a tenant or visibility revision that are applied to the
   * base query outside this package.
   */
  readonly cursorBinding?: unknown
}

/** @internal Conditional options tuple used by `QueryDefinition.resolve`. */
export type QueryResolveOptionArguments<Context, CursorState = never> = [
  Context | CursorState,
] extends [never]
  ? readonly [options?: QueryResolveOptions<never, never>]
  : readonly [options: QueryResolveOptions<Context, CursorState>]

/** Typed helpers supplied to the field-definition callback. */
export type DefineQueryHelpers<TTable extends Table> = {
  readonly col: ColumnCatalog<TTable>
  readonly rel: RelationHelpers<TTable>
  readonly expr: ExpressionHelpers
}

/** Callback used to declare the fields exposed by a query definition. */
export type DefineQueryFields<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
> = (helpers: DefineQueryHelpers<TTable>, table: TTable) => Fields

/** Options accepted by {@link defineQuery}. */
export type DefineQueryOptions<
  Pagination extends AnyPagination,
  FieldName extends string = string,
  CursorState = never,
  Context = never,
> = {
  /** Pagination implementation used by every resolved request. */
  readonly pagination: Pagination
  /** Default ordering used when the request does not provide one. */
  readonly defaultOrderBy?: readonly OrderRequest<FieldName>[]
  /** Composite non-null sortable tuples that uniquely identify one result row. */
  readonly uniqueBy?: readonly (readonly [FieldName, ...FieldName[]])[]
  /** Cursor representation and manual semantic revision. */
  readonly cursor?: {
    readonly codec?: CursorCodec
    /** Typed state carried by every cursor in one continuation chain. */
    readonly state?: CursorStateCodec<CursorState>
    /** Derives contextual filter inputs from state restored from the cursor. */
    readonly context?: (state: CursorState) => Context
    /** Bump when custom SQL semantics change without changing field metadata. */
    readonly revision?: string | number
  }
}

/** @internal Definition options after callback field names have been resolved. */
export type ResolvedDefineQueryOptions<
  Fields extends readonly AnyQueryField[],
  Pagination extends AnyPagination,
  CursorState = never,
> = DefineQueryOptions<
  Pagination,
  SortableFieldName<Fields>,
  CursorState,
  QueryContext<Fields>
>

/** Read-only capability metadata exposed by a query definition. */
export type QueryFilterOperatorInfo = {
  /** Public operator name accepted in filter conditions. */
  readonly name: string
  /** Whether the condition carries a right-hand-side value. */
  readonly kind: 'unary' | 'binary'
  /** Runtime value shape for binary operators. */
  readonly value?: FilterValueDescriptor
  /** Opaque adapter-owned metadata attached to this operator. */
  readonly annotations?: ReadonlyMap<symbol, unknown>
}

/** Read-only capability metadata exposed by a query definition. */
export type QueryFieldInfo = {
  /** Public field name used by filter and order requests. */
  readonly name: string
  /** Source used to build the field expression. */
  readonly origin: 'column' | 'expression' | 'relation' | 'virtual'
  /** Runtime filtering metadata used by schema and transport integrations. */
  readonly filterOperatorInfo: readonly QueryFilterOperatorInfo[]
  /** Whether the field can appear in ordering requests. */
  readonly sortable: boolean
  /** Whether the field alone deterministically identifies one row. */
  readonly unique: boolean
  /** Whether the field expression can evaluate to SQL `null`. */
  readonly nullable: boolean
}

/** Resolved-query type produced for a definition's fields and pagination. */
export type QueryResolution<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
  Pagination extends AnyPagination,
  CursorState = never,
> = ResolvedQuery<
  EffectiveOrderTerm<SortableFieldName<Fields>>,
  PaginationInfoOf<Pagination>,
  Pagination['kind'],
  TTable,
  Fields,
  CursorState
>

/** Structural query-definition constraint used by public extractor types. */
export type AnyQueryDefinition = {
  readonly resolve: (...arguments_: never[]) => unknown
}

/** Extracts the decoded request accepted by a query definition. */
export type QueryRequestOf<Definition extends AnyQueryDefinition> = NonNullable<
  Parameters<Definition['resolve']>[0]
>

/** Extracts the resolved-query value returned by a query definition. */
export type QueryResolutionOf<Definition extends AnyQueryDefinition> =
  ReturnType<Definition['resolve']>

/** Extracts the non-request options accepted while resolving a definition. */
export type QueryResolveOptionsOf<Definition extends AnyQueryDefinition> =
  NonNullable<Parameters<Definition['resolve']>[1]>

/** Extracts finalized page metadata from a query definition. */
export type QueryPageInfoOf<Definition extends AnyQueryDefinition> =
  QueryResolutionOf<Definition> extends ResolvedQuery<
    infer _Term,
    infer Info,
    infer _Kind
  >
    ? Info
    : never
