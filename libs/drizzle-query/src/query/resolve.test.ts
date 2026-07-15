import { describe, expect, test } from 'bun:test'
import { int, MySqlDialect, mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { integer, PgDialect, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import type { CursorStateCodec } from '../cursor/index'
import { cursorPagination, pagePagination } from '../pagination/index'
import { defineQuery } from './define'

const cursorStateCodec: CursorStateCodec<{ readonly asOf: string }> = {
  encode: (state) => state,
  decode: (encoded) => encoded as { readonly asOf: string },
}

describe('query request resolution across dialects', () => {
  test('renders filtering and deterministic ordering for PostgreSQL', () => {
    const records = pgTable('pg_query_records', {
      id: uuid('id').primaryKey(),
      name: text('name').notNull(),
      score: integer('score'),
    })
    const definition = defineQuery(
      records,
      ({ col }) => [
        col.id.sortable(),
        col.name.filterable(),
        col.score.sortable(),
      ],
      { pagination: pagePagination() }
    )
    const resolved = definition.resolve({
      filters: [
        {
          type: 'condition',
          field: 'name',
          operator: 'contains',
          value: 'studio',
        },
      ],
      orderBy: [{ field: 'score', direction: 'desc', nulls: 'last' }],
    })
    const dialect = new PgDialect()
    if (resolved.where === undefined) {
      throw new Error('Expected the filter to compile to a SQL predicate.')
    }

    expect(dialect.sqlToQuery(resolved.where).sql).toContain(
      '"pg_query_records"."name" like $1'
    )
    expect(
      resolved.ordering.orderBy.map(
        (expression) => dialect.sqlToQuery(expression).sql
      )
    ).toEqual([
      'case when "pg_query_records"."score" is null then 1 else 0 end asc',
      '"pg_query_records"."score" desc',
      '"pg_query_records"."id" asc',
    ])
  })

  test('renders filtering and deterministic ordering for MySQL', () => {
    const records = mysqlTable('mysql_query_records', {
      id: int('id').primaryKey(),
      name: varchar('name', { length: 255 }).notNull(),
      score: int('score'),
    })
    const definition = defineQuery(
      records,
      ({ col }) => [
        col.id.sortable(),
        col.name.filterable(),
        col.score.sortable(),
      ],
      { pagination: pagePagination() }
    )
    const resolved = definition.resolve({
      filters: [
        {
          type: 'condition',
          field: 'name',
          operator: 'startsWith',
          value: 'Acme',
        },
      ],
      orderBy: [{ field: 'score', direction: 'asc', nulls: 'first' }],
    })
    const dialect = new MySqlDialect()
    if (resolved.where === undefined) {
      throw new Error('Expected the filter to compile to a SQL predicate.')
    }

    expect(dialect.sqlToQuery(resolved.where).sql).toContain(
      '`mysql_query_records`.`name` like ?'
    )
    expect(
      resolved.ordering.orderBy.map(
        (expression) => dialect.sqlToQuery(expression).sql
      )
    ).toEqual([
      'case when `mysql_query_records`.`score` is null then 0 else 1 end asc',
      '`mysql_query_records`.`score` asc',
      '`mysql_query_records`.`id` asc',
    ])
  })

  test('carries typed state through cursor continuations', () => {
    const records = pgTable('stateful_cursor_records', {
      id: integer('id').primaryKey(),
    })
    const definition = defineQuery(
      records,
      ({ col }) => [col.id.sortable({ unique: true })],
      {
        cursor: { revision: 'stateful-v1', state: cursorStateCodec },
        defaultOrderBy: [{ field: 'id', direction: 'asc' }],
        pagination: cursorPagination({ defaultSize: 1 }),
      }
    )
    const state = { asOf: '2026-07-15T00:00:00.000Z' }
    const first = definition.resolve(
      { pagination: { size: 1 } },
      { cursor: { initialState: state } }
    )
    const metadataKey = Object.keys(first.requiredSelection)[0]
    const cursorAlias = first.ordering.cursorAliases[0]
    if (metadataKey === undefined || cursorAlias === undefined) {
      throw new Error('Expected cursor ordering metadata.')
    }
    const page = first.finalize([
      { id: 1, [metadataKey]: { [cursorAlias]: 1 } },
      { id: 2, [metadataKey]: { [cursorAlias]: 2 } },
    ])
    const after = page.pageInfo.nextCursor
    if (after === null) throw new Error('Expected a continuation cursor.')

    const continued = definition.resolve({ pagination: { after } }, {})
    expect(continued.cursorState).toEqual(state)
    expect(continued.pagination.seekWhere).toBeDefined()
  })
})
