import {
  type AnyColumn,
  extractExtendedColumnType,
  type GetColumnData,
} from 'drizzle-orm'

import type { CursorValueType } from '../cursor/index'
import {
  type AnyFilterOperator,
  appendOperators,
  bigintOperators,
  booleanOperators,
  type DefaultOperatorKind,
  type DefaultOperators,
  dateOperators,
  enumOperators,
  equalityOperators,
  type FilterValueDescriptor,
  nullableOperators,
  numberOperators,
  textOperators,
} from '../filtering/operators/index'

type OrderedStringDataType =
  | 'string date'
  | 'string datetime'
  | 'string int64'
  | 'string numeric'
  | 'string time'
  | 'string timestamp'
  | 'string uint64'
  | 'string unumeric'

export type FieldScalarKind = DefaultOperatorKind

export type ColumnKind<Column extends AnyColumn> =
  Column['_']['dataType'] extends 'string enum'
    ? 'enum'
    : Column['_']['dataType'] extends 'number' | `number ${string}`
      ? 'number'
      : Column['_']['dataType'] extends 'bigint' | `bigint ${string}`
        ? 'bigint'
        : Column['_']['dataType'] extends 'boolean'
          ? 'boolean'
          : Column['_']['dataType'] extends 'object date'
            ? 'date'
            : Column['_']['dataType'] extends OrderedStringDataType
              ? 'date'
              : Column['_']['dataType'] extends 'string'
                ? 'text'
                : Column['_']['dataType'] extends `string ${string}`
                  ? 'string'
                  : 'custom'

export type ColumnNullable<Column extends AnyColumn> =
  Column['_']['notNull'] extends true ? false : true

export type ColumnDefaults<Column extends AnyColumn> = DefaultOperators<
  ColumnKind<Column>,
  GetColumnData<Column, 'raw'>,
  ColumnNullable<Column>
>

export type ColumnSortMode<Column extends AnyColumn> =
  ColumnKind<Column> extends 'enum'
    ? 'enum'
    : ColumnKind<Column> extends 'custom'
      ? 'none'
      : 'default'

const orderedStringConstraints = new Set([
  'date',
  'datetime',
  'int64',
  'numeric',
  'time',
  'timestamp',
  'uint64',
  'unumeric',
])

export const columnKind = (column: AnyColumn): FieldScalarKind => {
  const type = extractExtendedColumnType(column)

  if (column.enumValues !== undefined) {
    return 'enum'
  }
  if (type.type === 'string') {
    if (type.constraint === undefined) {
      return 'text'
    }
    return orderedStringConstraints.has(type.constraint) ? 'date' : 'string'
  }
  if (
    type.type === 'number' ||
    type.type === 'bigint' ||
    type.type === 'boolean'
  ) {
    return type.type
  }
  if (type.type === 'object' && type.constraint === 'date') {
    return 'date'
  }
  return 'custom'
}

type ScalarProfile = {
  readonly operators: (
    enumValues: readonly string[],
    orderedString: boolean
  ) => readonly AnyFilterOperator[]
  readonly cursorType: (orderedString: boolean) => CursorValueType
  readonly filterValue: (
    enumValues: readonly string[],
    orderedString: boolean
  ) => FilterValueDescriptor
}

const scalarProfiles: Record<FieldScalarKind, ScalarProfile> = {
  text: {
    operators: () => textOperators(),
    cursorType: () => 'string',
    filterValue: () => ({ type: 'string' }),
  },
  string: {
    operators: () => equalityOperators<string>(),
    cursorType: () => 'string',
    filterValue: () => ({ type: 'string' }),
  },
  enum: {
    operators: (values) => enumOperators(values),
    cursorType: () => 'string',
    filterValue: (values) => ({ type: 'enum', values }),
  },
  number: {
    operators: () => numberOperators(),
    cursorType: () => 'number',
    filterValue: () => ({ type: 'number' }),
  },
  bigint: {
    operators: () => bigintOperators(),
    cursorType: () => 'bigint',
    filterValue: () => ({ type: 'bigint' }),
  },
  boolean: {
    operators: () => booleanOperators(),
    cursorType: () => 'boolean',
    filterValue: () => ({ type: 'boolean' }),
  },
  date: {
    operators: (_, orderedString) =>
      orderedString ? dateOperators<string>() : dateOperators<Date>(),
    cursorType: (orderedString) => (orderedString ? 'string' : 'date'),
    filterValue: (_, orderedString) =>
      orderedString ? { type: 'string' } : { type: 'date' },
  },
  custom: {
    operators: () => [],
    cursorType: () => 'string',
    filterValue: () => ({ type: 'unknown' }),
  },
}

export const defaultsForKind = (
  kind: FieldScalarKind,
  nullable: boolean,
  enumValues?: readonly string[],
  orderedString = false
): readonly AnyFilterOperator[] => {
  const defaults = scalarProfiles[kind].operators(
    enumValues ?? [],
    orderedString
  )

  return nullable ? appendOperators(defaults, nullableOperators()) : defaults
}

export const cursorTypeFor = (
  kind: FieldScalarKind,
  orderedString = false
): CursorValueType => scalarProfiles[kind].cursorType(orderedString)

export const filterValueFor = (
  kind: FieldScalarKind,
  enumValues?: readonly string[],
  orderedString = false
): FilterValueDescriptor =>
  scalarProfiles[kind].filterValue(enumValues ?? [], orderedString)
