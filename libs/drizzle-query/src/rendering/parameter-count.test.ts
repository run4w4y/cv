import { describe, expect, test } from 'bun:test'
import { eq, sql } from 'drizzle-orm'
import { integer, SQLiteDialect, sqliteTable } from 'drizzle-orm/sqlite-core'

import { countBoundParameters } from './parameter-count'

const records = sqliteTable('parameter_count_records', {
  id: integer('id').primaryKey(),
})
const dialect = new SQLiteDialect()

describe('bound parameter counting', () => {
  test('matches Drizzle for nested, encoded, and inline parameters', () => {
    const expression = sql`${eq(records.id, 7)} and ${sql`${8}`.inlineParams()} and ${sql.param(9)}`

    expect(countBoundParameters(expression)).toBe(
      dialect.sqlToQuery(expression).params.length
    )
    expect(countBoundParameters(expression)).toBe(2)
  })

  test('counts repeated fragments each time they are rendered', () => {
    const condition = eq(records.id, 7)

    expect(countBoundParameters(condition, condition)).toBe(2)
  })
})
