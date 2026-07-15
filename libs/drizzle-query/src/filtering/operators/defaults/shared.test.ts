import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { SQLiteDialect } from 'drizzle-orm/sqlite-core'

import { equalityOperators } from './shared'

const dialect = new SQLiteDialect()

const render = (operatorIndex: 2 | 3): string => {
  const operator = equalityOperators<string>()[operatorIndex]
  return dialect.sqlToQuery(
    operator.compile({
      expression: sql.identifier('value'),
      value: [],
      bind: (value) => sql.param(value),
    })
  ).sql
}

describe('empty list operators', () => {
  test('uses dialect-portable constant predicates', () => {
    expect(render(2)).toBe('(1 = 0)')
    expect(render(3)).toBe('(1 = 1)')
  })
})
