import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { SQLiteDialect } from 'drizzle-orm/sqlite-core'

import { buildCursorSeek } from './seek'
import type { CursorSeekTerm } from './types'

const dialect = new SQLiteDialect()

const occurrences = (source: string, fragment: string): number =>
  source.split(fragment).length - 1

describe('cursor seek SQL', () => {
  test('nests four lexicographic terms without repeating prior prefixes', () => {
    const names = ['a', 'b', 'c', 'd'] as const
    const seek = buildCursorSeek(
      names.map(
        (name, index): CursorSeekTerm => ({
          expression: sql.identifier(name),
          nullExpression: sql.identifier(name),
          direction: index % 2 === 0 ? 'asc' : 'desc',
          nulls: 'last',
          nullable: false,
          value: index + 1,
        })
      )
    )
    if (seek === undefined) throw new Error('Expected a seek predicate.')

    const rendered = dialect.sqlToQuery(seek)

    expect(rendered.params).toEqual([1, 1, 2, 2, 3, 3, 4])
    expect(occurrences(rendered.sql, '"a"')).toBe(2)
    expect(occurrences(rendered.sql, '"b"')).toBe(2)
    expect(occurrences(rendered.sql, '"c"')).toBe(2)
    expect(occurrences(rendered.sql, '"d"')).toBe(1)
    expect(rendered.sql).toContain('"a" = ?')
    expect(rendered.sql).toContain('"b" < ?')
    expect(rendered.sql).toContain('"c" = ?')
    expect(rendered.sql).toContain('"d" < ?')
  })

  test('uses the source null expression instead of repeating a ranked value', () => {
    const ranked = sql<number>`case ${sql.identifier('source')} when 'first' then 0 else 1 end`
    const seek = buildCursorSeek([
      {
        expression: ranked,
        nullExpression: sql.identifier('source'),
        direction: 'asc',
        nulls: 'last',
        nullable: true,
        value: 0,
      },
    ])
    if (seek === undefined) throw new Error('Expected a seek predicate.')

    const rendered = dialect.sqlToQuery(seek)

    expect(rendered.params).toEqual([0])
    expect(occurrences(rendered.sql, 'case ')).toBe(1)
    expect(rendered.sql).toContain('"source" is null')
  })

  test('continues through a null prefix when a later term has a successor', () => {
    const seek = buildCursorSeek([
      {
        expression: sql.identifier('nullable'),
        nullExpression: sql.identifier('nullable'),
        direction: 'asc',
        nulls: 'last',
        nullable: true,
        value: null,
      },
      {
        expression: sql.identifier('tie'),
        nullExpression: sql.identifier('tie'),
        direction: 'asc',
        nulls: 'last',
        nullable: false,
        value: 7,
      },
    ])
    if (seek === undefined) throw new Error('Expected a seek predicate.')

    const rendered = dialect.sqlToQuery(seek)

    expect(rendered.sql).toContain('"nullable" is null')
    expect(rendered.sql).toContain('and ("tie" > ?)')
    expect(rendered.params).toEqual([7])
  })
})
