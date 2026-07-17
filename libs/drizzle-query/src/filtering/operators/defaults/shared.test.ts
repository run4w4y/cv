import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { SQLiteDialect } from 'drizzle-orm/sqlite-core'

import { equalityOperators } from './shared'

const dialect = new SQLiteDialect()

const render = <Value>(operatorIndex: 2 | 3, values: readonly Value[]) => {
  const operator = equalityOperators<Value>()[operatorIndex]
  return dialect.sqlToQuery(
    operator.compile({
      expression: sql.identifier('value'),
      value: values,
      bind: (value) => sql.param(value),
    })
  )
}

describe('list operators', () => {
  test('uses dialect-portable constant predicates', () => {
    expect(render(2, []).sql).toBe('(1 = 0)')
    expect(render(3, []).sql).toBe('(1 = 1)')
  })

  test('preserves scalar operands for the field binder', () => {
    expect(render(2, ['alpha', 'alpha', 'beta']).params).toEqual([
      'alpha',
      'alpha',
      'beta',
    ])
    expect(render(3, [7n, 7n, 8n]).params).toEqual([7n, 7n, 8n])
  })
})
