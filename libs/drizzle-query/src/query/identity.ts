import { getTableUniqueName, type Table } from 'drizzle-orm'

import { cursorDefinitionIdentity } from '../cursor/index'
import type { AnyQueryField } from '../fields/index'
import type { AnyPagination, QueryFieldInfo } from './types'

const inferredOperatorValue = (
  shape: 'field' | 'array' | 'tuple',
  field: AnyQueryField['runtime']
) =>
  shape === 'array'
    ? { type: 'array' as const, item: field.filterValue }
    : shape === 'tuple'
      ? {
          type: 'tuple' as const,
          items: [field.filterValue, field.filterValue] as const,
        }
      : field.filterValue

export const fieldInfo = (field: AnyQueryField): QueryFieldInfo => ({
  name: field.runtime.name ?? '',
  origin: field.runtime.origin,
  filterOperatorInfo:
    field.runtime.operators?.map((operator) => ({
      name: operator.name,
      kind: operator.kind,
      ...(operator.kind === 'unary'
        ? {}
        : {
            value:
              operator.valueDescriptor ??
              inferredOperatorValue(operator.valueShape, field.runtime),
            ...(operator.annotations === undefined
              ? {}
              : { annotations: operator.annotations }),
          }),
    })) ?? [],
  sortable: field.runtime.sort?.enabled === true,
  unique:
    field.runtime.sort?.enabled === true ? field.runtime.sort.unique : false,
  nullable: field.runtime.nullable,
})

export const definitionIdentity = (
  table: Table,
  fields: readonly AnyQueryField[],
  pagination: AnyPagination,
  cursorRevision: string | number | undefined,
  uniqueBy: readonly (readonly string[])[],
  hasCursorState: boolean
): string =>
  cursorDefinitionIdentity({
    table: getTableUniqueName(table),
    pagination: pagination.kind,
    cursorRevision,
    hasCursorState,
    uniqueBy,
    fields: fields.map((field) => ({
      name: field.runtime.name,
      origin: field.runtime.origin,
      operators: field.runtime.operators?.map((operator) => operator.name),
      sortable: field.runtime.sort?.enabled === true,
      unique:
        field.runtime.sort?.enabled === true
          ? field.runtime.sort.unique
          : undefined,
      sortIdentity: field.runtime.sort?.cursorIdentity,
      nullable: field.runtime.nullable,
    })),
  })
