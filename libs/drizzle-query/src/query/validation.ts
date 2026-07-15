import { getColumns, type Table } from 'drizzle-orm'

import { CURSOR_EXTRA_PREFIX, QUERY_METADATA_KEY } from '../cursor/constants'
import { QueryError } from '../error'
import type { AnyQueryField } from '../fields/index'

export const validateDefinitionFields = <
  const Fields extends readonly AnyQueryField[],
>(
  fields: Fields
): Fields => {
  const names = new Set<string>()
  for (const [index, field] of fields.entries()) {
    const name = field.runtime.name
    if (name === undefined) {
      throw new QueryError(
        'invalid-definition',
        'Computed and relationship fields require an alias.',
        { path: `fields[${index}].name` }
      )
    }
    if (name === QUERY_METADATA_KEY || name.startsWith(CURSOR_EXTRA_PREFIX)) {
      throw new QueryError(
        'invalid-definition',
        `The field name "${name}" is reserved for query metadata.`,
        { path: `fields[${index}].name` }
      )
    }
    if (names.has(name)) {
      throw new QueryError(
        'invalid-definition',
        `The query field "${name}" is defined more than once.`,
        { path: `fields[${index}].name` }
      )
    }
    names.add(name)
  }

  return fields
}

/** @internal Protects RQB rows from collisions with private cursor extras. */
export const validateTableProjectionNames = (table: Table): void => {
  const reserved = Object.keys(getColumns(table)).find(
    (name) =>
      name === QUERY_METADATA_KEY || name.startsWith(CURSOR_EXTRA_PREFIX)
  )
  if (reserved !== undefined) {
    throw new QueryError(
      'invalid-definition',
      `The table column key "${reserved}" is reserved for query metadata.`,
      { path: `table.columns.${reserved}` }
    )
  }
}
