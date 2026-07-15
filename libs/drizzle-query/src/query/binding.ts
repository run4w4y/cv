import type { Table } from 'drizzle-orm'

import {
  type AnyQueryField,
  createColumnCatalog,
  createRelationHelpers,
  expressionHelpers,
  type FieldRuntime,
} from '../fields/index'
import type { DefineQueryFields } from './types'
import {
  validateDefinitionFields,
  validateTableProjectionNames,
} from './validation'

/** Fields and runtime lookup rebound to one concrete Drizzle table instance. */
export type QueryFieldBinding<Fields extends readonly AnyQueryField[]> = {
  readonly fields: Fields
  readonly registry: ReadonlyMap<string, FieldRuntime>
}

const registryFor = (
  fields: readonly AnyQueryField[]
): ReadonlyMap<string, FieldRuntime> =>
  new Map(fields.map((field) => [field.runtime.name ?? '', field.runtime]))

const bindDeclaredFields = <
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
>(
  table: TTable,
  defineFields: DefineQueryFields<TTable, Fields>
): QueryFieldBinding<Fields> => {
  const fields = validateDefinitionFields(
    defineFields(
      {
        col: createColumnCatalog(table),
        rel: createRelationHelpers(table),
        expr: expressionHelpers,
      },
      table
    )
  )

  return { fields, registry: registryFor(fields) }
}

/**
 * Owns alias binding for a definition and caches each Drizzle table object.
 * Request resolution never runs again when a renderer asks for another target.
 */
export class QueryBindings<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
> {
  readonly #defineFields: DefineQueryFields<TTable, Fields>
  readonly #cache = new WeakMap<Table, QueryFieldBinding<Fields>>()
  readonly original: QueryFieldBinding<Fields>

  constructor(
    table: TTable,
    defineFields: DefineQueryFields<TTable, Fields>,
    fields: Fields
  ) {
    this.#defineFields = defineFields
    validateTableProjectionNames(table)
    const validated = validateDefinitionFields(fields)
    this.original = { fields: validated, registry: registryFor(validated) }
    this.#cache.set(table, this.original)
  }

  /** Returns the cached runtime field set for a table or RQB root alias. */
  for(table: Table): QueryFieldBinding<Fields> {
    const cached = this.#cache.get(table)
    if (cached !== undefined) return cached

    // RQB and `alias()` preserve the table's columns/codecs while changing its
    // table-name type. Replaying the callback is therefore safe at this seam.
    const bound = bindDeclaredFields(table as TTable, this.#defineFields)
    this.#cache.set(table, bound)
    return bound
  }
}
