import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { integer, sqliteTable } from 'drizzle-orm/sqlite-core'

import { QueryError } from '../error'
import { binaryFilterOperator } from '../filtering/index'
import { pagePagination } from '../pagination/index'
import { defineQuery } from './define'

describe('query metadata names', () => {
  test('rejects query fields in the private relational cursor namespace', () => {
    const records = sqliteTable('reserved_query_field_records', {
      id: integer('id').primaryKey(),
    })

    expect(() =>
      defineQuery(
        records,
        ({ col, expr }) => [
          col.id.sortable(),
          expr.number(sql<number>`1`).as('__drizzle_query_term_0'),
        ],
        { pagination: pagePagination() }
      )
    ).toThrow(QueryError)
  })

  test('rejects table result keys that could overwrite private cursor extras', () => {
    const records = sqliteTable('reserved_table_column_records', {
      id: integer('id').primaryKey(),
      __drizzle_query_term_0: integer('ordinary_database_name'),
    })

    try {
      defineQuery(records, ({ col }) => [col.id.sortable()], {
        pagination: pagePagination(),
      })
      throw new Error('Expected a reserved table-column error.')
    } catch (error) {
      expect(error).toBeInstanceOf(QueryError)
      expect((error as QueryError).path).toBe(
        'table.columns.__drizzle_query_term_0'
      )
    }
  })
})

describe('query operator metadata', () => {
  test('derives custom operand shapes from operator metadata, not names', () => {
    const records = sqliteTable('operator_shape_records', {
      id: integer('id').primaryKey(),
    })
    const oneOf = binaryFilterOperator<'oneOf', readonly number[]>('oneOf', {
      valueShape: 'array',
      compile: () => sql`1 = 1`,
    })
    const query = defineQuery(
      records,
      ({ col }) => [col.id.filterable([oneOf]).sortable()],
      { pagination: pagePagination() }
    )

    expect(query.fields[0]?.filterOperatorInfo).toEqual([
      {
        name: 'oneOf',
        kind: 'binary',
        value: { type: 'array', item: { type: 'number' } },
      },
    ])
  })
})
