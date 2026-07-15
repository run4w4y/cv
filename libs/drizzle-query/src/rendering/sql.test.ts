import { describe, expect, test } from 'bun:test'
import {
  integer,
  SQLiteDialect,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { createColumnCatalog } from '../fields/index'
import { resolveOrdering } from '../ordering/resolve'
import {
  type CursorPageInfo,
  cursorPagination,
  type PageInfo,
  pagePagination,
} from '../pagination/index'
import type { QueryRequestIr } from '../query/ir'
import { renderQuerySql } from './sql'

const records = sqliteTable('rendered_ordering_records', {
  id: integer('id').primaryKey(),
  category: text('category').notNull(),
  score: integer('score'),
})

const col = createColumnCatalog(records)
const fields = [
  col.id.sortable().runtime,
  col.category.filterable().runtime,
  col.score.sortable().runtime,
] as const
const registry = new Map(
  fields.map((field) => [field.name ?? '', field] as const)
)
const ordering = resolveOrdering<'id' | 'score'>(
  registry,
  [{ field: 'score', direction: 'desc', nulls: 'first' }],
  {}
).terms
const filters = [
  {
    type: 'condition' as const,
    field: 'category',
    operator: 'eq',
    value: 'keep',
  },
]
const dialect = new SQLiteDialect()

describe('shared IR SQL rendering', () => {
  test('lowers ordering, cursor projections, filtering, and cursor seek together', () => {
    const pagination = cursorPagination({
      defaultSize: 2,
      maxSize: 10,
    }).compile(
      { after: 'opaque-cursor', size: 2 },
      { cursor: { decode: () => [10, 2] } }
    )
    const ir = {
      filters,
      ordering,
      pagination,
      operatorContext: undefined,
      cursorIdentity: 'renderer-test',
      codec: undefined,
      cursorState: undefined,
      encodedCursorState: undefined,
      hasCursorState: false,
    } satisfies QueryRequestIr<'id' | 'score', CursorPageInfo, 'cursor'>

    const rendered = renderQuerySql(registry, ir)
    const seekWhere = rendered.pagination.seekWhere
    const where = rendered.where
    if (seekWhere === undefined || where === undefined) {
      throw new Error('Expected filtering and cursor seek SQL.')
    }

    expect(rendered.ordering.cursorProjections).toMatchObject([
      { field: 'score', alias: '__drizzle_query_term_0' },
      { field: 'id', alias: '__drizzle_query_term_1' },
    ])
    expect(
      rendered.ordering.orderBy.map(
        (expression) => dialect.sqlToQuery(expression).sql
      )
    ).toEqual([
      'case when "rendered_ordering_records"."score" is null then 0 else 1 end asc',
      '"rendered_ordering_records"."score" desc',
      '"rendered_ordering_records"."id" asc',
    ])
    const renderedSeek = dialect.sqlToQuery(seekWhere)
    expect(renderedSeek.sql).toContain(
      '"rendered_ordering_records"."score" < ?'
    )
    expect(renderedSeek.sql).toContain(
      '"rendered_ordering_records"."score" = ?'
    )
    expect(renderedSeek.sql).toContain('"rendered_ordering_records"."id" > ?')
    expect(renderedSeek.sql).not.toContain(
      '"rendered_ordering_records"."id" is null'
    )
    expect(renderedSeek.params).toEqual([10, 10, 2])
    expect(dialect.sqlToQuery(where)).toMatchObject({
      params: ['keep', 10, 10, 2],
    })
    expect(rendered.pagination).toMatchObject({
      kind: 'cursor',
      size: 2,
      limit: 3,
      offset: undefined,
    })
  })

  test('does not request cursor projections for page pagination', () => {
    const pagination = pagePagination({ defaultSize: 2, maxSize: 10 }).compile(
      { page: 2, size: 2 },
      {}
    )
    const ir = {
      filters,
      ordering,
      pagination,
      operatorContext: undefined,
      cursorIdentity: undefined,
      codec: undefined,
      cursorState: undefined,
      encodedCursorState: undefined,
      hasCursorState: false,
    } satisfies QueryRequestIr<'id' | 'score', PageInfo, 'page'>

    const rendered = renderQuerySql(registry, ir)

    expect(rendered.ordering.cursorProjections).toEqual([])
    expect(rendered.pagination).toMatchObject({
      kind: 'page',
      size: 2,
      seekWhere: undefined,
      limit: 3,
      offset: 2,
    })
  })
})
