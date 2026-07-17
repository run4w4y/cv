import { sql } from 'drizzle-orm'

import { QueryError } from '../error'
import {
  compileDefinitionLiteral,
  compileDefinitionRank,
} from './definition-literal'
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

    const cases = values.map((value, index) => {
      const definitionValue = compileDefinitionLiteral(current, value)
      const definitionRank = compileDefinitionRank(index)
      return sql`when ${definitionValue} then ${definitionRank}`
    })
    const fallbackRank = compileDefinitionRank(values.length)
    // A simple CASE emits the source expression once per rank operation,
    // instead of once for every enum member. Only definition-owned literals
    // are inlined; the expression and all request/cursor values stay outside
    // the inline fragments and therefore retain normal parameter binding.
    const ranked = sql<number>`case when ${current.nullExpression} is null then null else case ${current.expression} ${sql.join(cases, sql` `)} else ${fallbackRank} end end`
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
