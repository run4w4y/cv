import type { Table } from 'drizzle-orm'
import { QueryError } from '../error'
import {
  type AnyQueryField,
  createColumnCatalog,
  createRelationHelpers,
  expressionHelpers,
} from '../fields/index'
import {
  type EffectiveOrderTerm,
  resolveOrdering,
  resolveUniqueBy,
} from '../ordering/index'
import { ResolvedQuery } from '../resolved-query'
import { QueryBindings } from './binding'
import { definitionIdentity, fieldInfo } from './identity'
import type { QueryDefinitionIr } from './ir'
import { resolveQueryRequest } from './resolve'
import type {
  AnyPagination,
  DefineQueryFields,
  QueryContext,
  QueryFieldInfo,
  QueryRequest,
  QueryResolution,
  QueryResolveOptionArguments,
  QueryResolveOptions,
  ResolvedDefineQueryOptions,
  SortableFieldName,
} from './types'

/**
 * A reusable, table-first query definition produced by {@link defineQuery}.
 * It stores target-neutral capabilities and lazily binds SQL expressions to
 * ordinary tables or relational-query aliases.
 */
export class QueryDefinition<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
  Pagination extends AnyPagination,
  CursorState = never,
> {
  readonly #table: TTable
  readonly #bindings: QueryBindings<TTable, Fields>
  readonly #fieldInfo: readonly QueryFieldInfo[]
  readonly #pagination: Pagination
  readonly #ir: QueryDefinitionIr<SortableFieldName<Fields>, CursorState>

  /** Creates a reusable definition from a table, field declaration, and options. */
  constructor(
    table: TTable,
    defineFields: DefineQueryFields<TTable, Fields>,
    options: ResolvedDefineQueryOptions<Fields, Pagination, CursorState>
  ) {
    const fields = defineFields(
      {
        col: createColumnCatalog(table),
        rel: createRelationHelpers(table),
        expr: expressionHelpers,
      },
      table
    )
    const bindings = new QueryBindings(table, defineFields, fields)
    const registry = bindings.original.registry
    const uniqueBy = resolveUniqueBy<SortableFieldName<Fields>>(
      registry,
      options.uniqueBy
    )
    const cursorRevision = options.cursor?.revision
    if (
      cursorRevision !== undefined &&
      !(
        (typeof cursorRevision === 'string' && cursorRevision.length > 0) ||
        (typeof cursorRevision === 'number' &&
          Number.isSafeInteger(cursorRevision))
      )
    ) {
      throw new QueryError(
        'invalid-definition',
        'Cursor revision must be a non-empty string or safe integer.',
        { path: 'cursor.revision' }
      )
    }

    const defaultOrdering = resolveOrdering<SortableFieldName<Fields>>(
      registry,
      undefined,
      {
        defaults: options.defaultOrderBy ?? [],
        uniqueBy,
      }
    ).terms

    this.#table = table
    this.#bindings = bindings
    this.#fieldInfo = bindings.original.fields.map(fieldInfo)
    this.#pagination = options.pagination
    this.#ir = {
      identity: definitionIdentity(
        table,
        bindings.original.fields,
        options.pagination,
        cursorRevision,
        uniqueBy,
        options.cursor?.state !== undefined
      ),
      usesCursor: options.pagination.usesCursor,
      uniqueBy,
      defaultOrdering,
      codec: options.cursor?.codec,
      stateCodec: options.cursor?.state,
      contextFromState: options.cursor?.context,
    }
  }

  /** Drizzle table supplied as the first argument to {@link defineQuery}. */
  get table(): TTable {
    return this.#table
  }

  /** Public filter/order capability metadata for the declared fields. */
  get fields(): readonly QueryFieldInfo[] {
    return this.#fieldInfo
  }

  /** Pagination implementation selected when this definition was created. */
  get pagination(): Pagination {
    return this.#pagination
  }

  /**
   * Resolves an already-decoded request once. SQL rendering is deferred and
   * cached independently for ordinary selects and relational-query aliases.
   */
  resolve(
    input: QueryRequest<Fields, Pagination> = {},
    ...options: QueryResolveOptionArguments<QueryContext<Fields>, CursorState>
  ): QueryResolution<TTable, Fields, Pagination, CursorState> {
    const ir = resolveQueryRequest(
      {
        registry: this.#bindings.original.registry,
        pagination: this.#pagination,
        ir: this.#ir,
      },
      input,
      (options[0] ?? {}) as QueryResolveOptions<
        QueryContext<Fields>,
        CursorState
      >
    )

    return new ResolvedQuery<
      EffectiveOrderTerm<SortableFieldName<Fields>>,
      ReturnType<typeof ir.pagination.finish>['pageInfo'],
      Pagination['kind'],
      TTable,
      Fields,
      CursorState
    >({ state: { table: this.#table, bindings: this.#bindings }, ir })
  }
}
