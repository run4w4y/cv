import {
  type AnyColumn,
  extractExtendedColumnType,
  type GetColumnData,
  getColumns,
  type SQL,
  sql,
  type Table,
} from 'drizzle-orm'

import { QueryField } from './query-field'
import type { AnyQueryField } from './runtime'
import {
  type ColumnDefaults,
  type ColumnNullable,
  type ColumnSortMode,
  columnKind,
  cursorTypeFor,
  defaultsForKind,
  filterValueFor,
} from './scalar-kind'

/** Query-field builder inferred from one Drizzle column. */
export type ColumnField<
  Name extends string,
  Column extends AnyColumn,
> = QueryField<
  Name,
  GetColumnData<Column, 'raw'>,
  ColumnNullable<Column>,
  ColumnDefaults<Column>,
  undefined,
  false,
  undefined,
  ColumnSortMode<Column>,
  undefined,
  'column'
>

type DefaultColumnField<Name extends string, Column extends AnyColumn> =
  ColumnDefaults<Column> extends readonly []
    ? never
    : QueryField<
        Name,
        GetColumnData<Column, 'raw'>,
        ColumnNullable<Column>,
        ColumnDefaults<Column>,
        ColumnDefaults<Column>,
        ColumnSortMode<Column> extends 'default' ? true : false,
        undefined,
        ColumnSortMode<Column>,
        undefined,
        'column'
      >

type DefaultColumnFields<TTable extends Table, Excluded extends string> = {
  readonly [Name in Exclude<
    keyof TTable['_']['columns'] & string,
    Excluded
  >]: DefaultColumnField<Name, TTable['_']['columns'][Name]>
}[Exclude<keyof TTable['_']['columns'] & string, Excluded>]

/**
 * Field builders keyed by a Drizzle table's columns. Calling the catalog
 * enables inferred filtering and scalar ordering for every suitable column.
 */
export type ColumnCatalog<TTable extends Table> = {
  readonly [Name in keyof TTable['_']['columns'] & string]: ColumnField<
    Name,
    TTable['_']['columns'][Name]
  >
} & (<
  const Excluded extends readonly (keyof TTable['_']['columns'] &
    string)[] = readonly [],
>(options?: {
  /** Columns whose semantics will be declared explicitly by the consumer. */
  readonly exclude?: Excluded
}) => readonly DefaultColumnFields<TTable, Excluded[number]>[])

const makeColumnField = <Name extends string, Column extends AnyColumn>(
  name: Name,
  column: Column
): ColumnField<Name, Column> => {
  const extended = extractExtendedColumnType(column)
  const kind = columnKind(column)
  const orderedString = kind === 'date' && extended.type === 'string'
  const nullable = !column.notNull
  const defaults = defaultsForKind(
    kind,
    nullable,
    column.enumValues,
    orderedString
  ) as ColumnDefaults<Column>
  const sortMode = (
    kind === 'enum' ? 'enum' : kind === 'custom' ? 'none' : 'default'
  ) as ColumnSortMode<Column>

  const sort =
    sortMode === 'none'
      ? undefined
      : {
          enabled: false,
          expression: column,
          cursorType: {
            type: cursorTypeFor(kind, orderedString),
            nullable,
          },
          unique: column.primary || column.isUnique,
          nullable,
          defaultNulls: 'last' as const,
          selection: (alias: string) =>
            sql`${column}`.mapWith(column).as(alias) as SQL.Aliased<unknown>,
        }

  return new QueryField<
    Name,
    GetColumnData<Column, 'raw'>,
    ColumnNullable<Column>,
    ColumnDefaults<Column>,
    undefined,
    false,
    undefined,
    ColumnSortMode<Column>,
    undefined,
    'column'
  >({
    runtime: {
      name,
      origin: 'column',
      nullable,
      expression: column,
      filterValue: filterValueFor(kind, column.enumValues, orderedString),
      bind: (value: unknown) => sql.param(value, column),
      operators: undefined,
      operatorMap: undefined,
      sort,
    },
    defaults,
    tools: undefined,
    sortMode,
  })
}

/** @internal Builds the column helpers supplied by {@link defineQuery}. */
export const createColumnCatalog = <TTable extends Table>(
  table: TTable
): ColumnCatalog<TTable> => {
  const columns = getColumns(table)
  const fields = ((options?: { readonly exclude?: readonly string[] }) => {
    const excluded = new Set(options?.exclude)
    const defaults: AnyQueryField[] = []

    for (const [name, column] of Object.entries(columns)) {
      if (excluded.has(name)) continue

      const field = makeColumnField(name, column)
      const kind = columnKind(column)
      if (kind === 'custom') continue

      const configurable = field as unknown as {
        filterable: () => AnyQueryField & { sortable: () => AnyQueryField }
      }
      const filterable = configurable.filterable()
      defaults.push(kind === 'enum' ? filterable : filterable.sortable())
    }

    return defaults
  }) as unknown as ColumnCatalog<TTable>
  Object.setPrototypeOf(fields, null)
  for (const [name, column] of Object.entries(columns)) {
    Object.defineProperty(fields, name, {
      configurable: false,
      enumerable: true,
      value: makeColumnField(name, column),
      writable: false,
    })
  }
  return fields
}
