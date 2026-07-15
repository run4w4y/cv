import { isSQLWrapper, type SQLWrapper, sql } from 'drizzle-orm'

import { QueryError } from '../error'
import type { NullPlacement, SortRuntime } from './runtime'

/** Ordering semantics shared by scalar sortable fields. */
export type SortableOptions = {
  /** Marks the field as a non-null single-column row identity. */
  readonly unique?: boolean
  /** Default placement used when the field is nullable. */
  readonly nulls?: NullPlacement
}

/** Ordering options for enums, including their explicit semantic rank. */
export type EnumSortableOptions<Value extends string> = SortableOptions & {
  readonly values: readonly [Value, ...Value[]]
}

type InternalSortableOptions = SortableOptions & {
  readonly values?: readonly [string, ...string[]]
}

/** @internal Resolves a field's sortable runtime. */
export const applySortableOptions = (
  current: SortRuntime,
  options: InternalSortableOptions,
  path: string
): SortRuntime => {
  let sort = current
  const values = options.values
  if (values !== undefined) {
    // The public enum overload makes this statically non-empty. The only
    // runtime invariant left here is uniqueness, which TypeScript cannot
    // express for an arbitrary tuple.
    if (new Set(values).size !== values.length) {
      throw new QueryError(
        'invalid-definition',
        'Enum ordering values may not contain duplicates.',
        { path: `${path}.values` }
      )
    }

    const cases = values.map(
      (value, index) =>
        sql`when ${current.expression} = ${currentValue(current, value)} then ${index}`
    )
    const ranked = sql<number>`case when ${current.expression} is null then null ${sql.join(cases, sql` `)} else ${values.length} end`
    sort = {
      ...current,
      expression: ranked,
      cursorType: { type: 'number', nullable: current.nullable },
      nullable: current.nullable,
      selection: (alias) => ranked.as(alias),
      encode: undefined,
      cursorIdentity: {
        kind: 'enum-rank',
        values,
      },
    }
  }

  return {
    ...sort,
    enabled: true,
    unique: options.unique ?? sort.unique,
    defaultNulls: options.nulls ?? sort.defaultNulls,
  }
}

const currentValue = (sort: SortRuntime, value: string): SQLWrapper => {
  const encoded = sort.encode?.(value) ?? value
  return isSQLWrapper(encoded) ? encoded : sql.param(encoded)
}
