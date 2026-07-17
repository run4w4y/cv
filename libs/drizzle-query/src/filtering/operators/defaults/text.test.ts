import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import { PgDialect } from 'drizzle-orm/pg-core'
import { SQLiteDialect } from 'drizzle-orm/sqlite-core'

import { textOperators } from './text'

const dialects = [new SQLiteDialect(), new PgDialect(), new MySqlDialect()]

describe('text operators', () => {
  test('binds literal patterns and inlines only the static escape character', () => {
    const contains = textOperators()[4]
    const attack = `%_!\\' or 1 = 1 --`

    for (const dialect of dialects) {
      const rendered = dialect.sqlToQuery(
        contains.compile({
          expression: sql.identifier('value'),
          value: attack,
          bind: (value) => sql.param(value),
        })
      )

      expect(rendered.sql.toLowerCase()).toContain(' like ')
      expect(rendered.sql).toContain("escape '!'")
      expect(rendered.sql).not.toContain(attack)
      expect(rendered.params).toEqual([`%!%!_!!\\' or 1 = 1 --%`])
    }
  })
})
