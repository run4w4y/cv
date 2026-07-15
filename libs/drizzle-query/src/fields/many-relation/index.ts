import {
  type AnyColumn,
  and,
  Column,
  extractExtendedColumnType,
  type GetColumnData,
  getColumns,
  is,
  type SQL,
  type SQLWrapper,
  sql,
  type Table,
} from 'drizzle-orm'

import { QueryError } from '../../error'
import type { FilterValueBinder } from '../../filtering/operators/index'
import { makeExpressionField } from '../expressions'
import { QueryField } from '../query-field'
import { columnKind, filterValueFor } from '../scalar-kind'
import { makeRelationOperators } from './operators'
import type {
  ManyRelationColumnOptions,
  ManyRelationExpressionOptions,
  ManyRelationField,
  ManyRelationFilterTools,
  ManyRelationRuntimeOptions,
  RelationHelpers,
} from './types'

export type {
  ManyRelationField,
  ManyRelationFilterTools,
  ManyRelationOperators,
  ManyRelationOptions,
  RelationHelpers,
} from './types'

const eraseBinderValue = <Value>(
  bind: (value: Value) => SQLWrapper
): FilterValueBinder => bind as FilterValueBinder

const makeManyRelation = <Root extends Table, Related extends Table, Value>(
  rootTable: Root,
  relatedTable: Related,
  options: ManyRelationRuntimeOptions<Root, Related, Value>
): ManyRelationField<Value> => {
  if (Object.is(rootTable, relatedTable)) {
    throw new QueryError(
      'invalid-definition',
      'Self-relations require an explicitly aliased related table.',
      { path: 'relations.many.related' }
    )
  }
  const root = getColumns(rootTable)
  const related = getColumns(relatedTable)
  const on = options.on({ root, related })
  const value = options.value({ related })
  const column = is(value, Column) ? value : undefined
  const kind = column === undefined ? undefined : columnKind(column)
  const extended =
    column === undefined ? undefined : extractExtendedColumnType(column)
  const orderedString = kind === 'date' && extended?.type === 'string'
  const explicitBind = options.bind
  const typedBind: (item: Value) => SQLWrapper =
    explicitBind !== undefined
      ? explicitBind
      : column === undefined
        ? (item) => sql.param(item)
        : (item) => sql.param(item, column)
  const bind = eraseBinderValue(typedBind)

  const existsWhere = (predicate?: SQLWrapper): SQL => {
    const where = predicate === undefined ? on : (and(on, predicate) ?? on)
    return sql`exists (select 1 from ${relatedTable} where ${where})`
  }
  const tools: ManyRelationFilterTools = {
    value,
    exists: existsWhere,
    notExists: (predicate) => sql`not (${existsWhere(predicate)})`,
  }
  const defaults = makeRelationOperators<Value>(tools, typedBind)

  return new QueryField({
    runtime: {
      name: undefined,
      origin: 'relation',
      nullable: false,
      expression: value,
      filterValue:
        options.filterValue ??
        (column === undefined || kind === undefined
          ? { type: 'unknown' }
          : filterValueFor(kind, column.enumValues, orderedString)),
      bind,
      operators: undefined,
      operatorMap: undefined,
      sort: undefined,
    },
    defaults,
    tools,
    sortMode: 'none',
    count: () => {
      const expression =
        sql<number>`(select count(*) from ${relatedTable} where ${on})`.mapWith(
          Number
        )
      return makeExpressionField(expression, 'number', {}, 'default')
    },
  })
}

class BoundRelationHelpers<Root extends Table>
  implements RelationHelpers<Root>
{
  readonly #root: Root

  constructor(root: Root) {
    this.#root = root
  }

  many<Related extends Table, ColumnType extends AnyColumn>(
    related: Related,
    options: ManyRelationColumnOptions<Root, Related, ColumnType>
  ): ManyRelationField<GetColumnData<ColumnType, 'raw'>>
  many<Related extends Table, Value>(
    related: Related,
    options: ManyRelationExpressionOptions<Root, Related, Value>
  ): ManyRelationField<Value>
  many<Related extends Table, Value>(
    related: Related,
    options: ManyRelationRuntimeOptions<Root, Related, Value>
  ): ManyRelationField<Value> {
    return makeManyRelation(this.#root, related, options)
  }
}

/** @internal Binds relationship helpers to the definition's root table. */
export const createRelationHelpers = <Root extends Table>(
  root: Root
): RelationHelpers<Root> => new BoundRelationHelpers(root)
