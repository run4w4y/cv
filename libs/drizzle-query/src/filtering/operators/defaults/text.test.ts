import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { SQLiteDialect } from 'drizzle-orm/sqlite-core'

import { textOperators } from './text'

const dialect = new SQLiteDialect()

describe('text operators', () => {
  test('binds literal patterns without interpolating request text into SQL', () => {
    const contains = textOperators()[4]
    const attack = `%_' or 1 = 1 --`
    const rendered = dialect.sqlToQuery(
      contains.compile({
        expression: sql.identifier('value'),
        value: attack,
        bind: (value) => sql.param(value),
      })
    )

    expect(rendered.sql).toBe('"value" like ? escape ?')
    expect(rendered.sql).not.toContain(attack)
    expect(rendered.params).toEqual([`%\\%\\_' or 1 = 1 --%`, '\\'])
  })
})
