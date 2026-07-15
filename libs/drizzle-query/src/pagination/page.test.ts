import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { EffectSQLiteD1Database } from 'drizzle-orm/effect-d1'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { defineQuery, pagePagination, QueryError } from '../index'
import { pageOffset } from './page'

const records = sqliteTable('records', {
  id: integer('id').primaryKey(),
  category: text('category').notNull(),
  score: integer('score'),
})

type RecordRow = typeof records.$inferSelect

const fixtureRows: RecordRow[] = [
  { id: 7, category: 'keep', score: 2 },
  { id: 1, category: 'keep', score: null },
  { id: 9, category: 'keep', score: 3 },
  { id: 3, category: 'keep', score: 1 },
  { id: 8, category: 'drop', score: null },
  { id: 4, category: 'keep', score: null },
  { id: 6, category: 'keep', score: 1 },
  { id: 2, category: 'drop', score: 1 },
  { id: 5, category: 'keep', score: 2 },
]

const makeFixture = async () => {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    create table records (
      id integer primary key not null,
      category text not null,
      score integer
    )
  `)

  const db = drizzle({ client: sqlite })
  await db.insert(records).values(fixtureRows)

  return { db, sqlite }
}

const pageRecords = defineQuery(
  records,
  ({ col }) => [
    col.id.sortable({ unique: true }),
    col.category.filterable(),
    col.score.filterable().sortable(),
  ],
  {
    pagination: pagePagination({ defaultSize: 2, maxSize: 10 }),
  }
)

const preserveEffectBuilder = (database: EffectSQLiteD1Database) => {
  const dynamic = database.select().from(records).$dynamic()
  const applied = pageRecords.resolve().apply(dynamic)
  const exact: typeof dynamic = applied
  return exact
}

void preserveEffectBuilder

const pageTypeContracts = (): void => {
  // @ts-expect-error Page pagination does not accept a cursor.
  pageRecords.resolve({ pagination: { after: 'cursor' } })

  const composite = defineQuery(
    records,
    ({ col }) => [col.id.sortable(), col.category.sortable()],
    {
      pagination: pagePagination(),
      uniqueBy: [['category', 'id']],
    }
  )
  composite.resolve({ orderBy: [{ field: 'category' }] })

  defineQuery(
    records,
    ({ col }) => [col.id.sortable({ unique: true }), col.category],
    {
      pagination: pagePagination(),
      defaultOrderBy: [
        // @ts-expect-error Default ordering is limited to sortable fields.
        { field: 'category' },
      ],
    }
  )

  defineQuery(records, ({ col }) => [col.id.sortable({ unique: true })], {
    pagination: pagePagination(),
    uniqueBy: [
      [
        // @ts-expect-error Unique candidates are limited to declared sortable fields.
        'missing',
      ],
    ],
  })

  defineQuery(records, ({ col }) => [col.id.sortable({ unique: true })], {
    pagination: pagePagination(),
    // @ts-expect-error A composite unique candidate cannot be empty.
    uniqueBy: [[]],
  })

  defineQuery(records, ({ col }) => [col.category], {
    pagination: pagePagination(),
    defaultOrderBy: [
      // @ts-expect-error A definition without sortable fields has no order names.
      { field: 'category' },
    ],
  })
}

void pageTypeContracts

describe('page pagination and generic application', () => {
  test('computes safe one-based page offsets', () => {
    expect(pageOffset(1, 25)).toBe(0)
    expect(pageOffset(3, 25)).toBe(50)
    expect(() => pageOffset(0, 25)).toThrow(QueryError)
    expect(() => pageOffset(2, 0)).toThrow(QueryError)
    expect(() => pageOffset(Number.MAX_SAFE_INTEGER, 2)).toThrow(QueryError)
  })

  test('validates composite unique fields when building a definition', () => {
    expect(() =>
      defineQuery(
        records,
        ({ col }) => [col.id.sortable({ unique: true }), col.category],
        {
          pagination: pagePagination(),
          uniqueBy: [
            [
              // @ts-expect-error Runtime guards also protect untyped callers.
              'category',
            ],
          ],
        }
      )
    ).toThrow(QueryError)
  })

  test('requires a unique non-null sortable field without a default order', () => {
    expect(() =>
      defineQuery(records, ({ col }) => [col.category.sortable()], {
        pagination: pagePagination(),
      })
    ).toThrow(QueryError)
  })

  test('applies filtering, ordering, size + 1, offset, and finalizes totals', async () => {
    const fixture = await makeFixture()

    try {
      const resolved = pageRecords.resolve({
        filters: [
          {
            type: 'condition',
            field: 'category',
            operator: 'eq',
            value: 'keep',
          },
        ],
        pagination: { page: 2, size: 2 },
      })

      expect(resolved.pagination).toMatchObject({
        kind: 'page',
        size: 2,
        limit: 3,
        offset: 2,
      })

      const dynamic = fixture.db.select().from(records).$dynamic()
      const applied = resolved.apply(dynamic)
      // This assignment is a compile-time contract: `apply` retains every
      // dialect- and execution-specific member of the exact dynamic builder.
      const exactBuilder: typeof dynamic = applied
      const rows = await exactBuilder.all()
      const page = resolved.finalize(rows, 7)

      expect(rows.map((row) => row.id)).toEqual([4, 5, 6])
      expect(page.items.map((row) => row.id)).toEqual([4, 5])
      expect(page.pageInfo).toEqual({
        kind: 'page',
        page: 2,
        size: 2,
        hasNextPage: true,
        hasPreviousPage: true,
        totalItems: 7,
        pageCount: 4,
      })
    } finally {
      fixture.sqlite.close()
    }
  })

  test('combines a consumer where fragment with resolved filters exactly once', async () => {
    const fixture = await makeFixture()

    try {
      const resolved = pageRecords.resolve({
        filters: [
          {
            type: 'condition',
            field: 'score',
            operator: 'gte',
            value: 1,
          },
        ],
        pagination: { size: 10 },
      })
      const base = fixture.db.select().from(records).$dynamic()
      const rows = await resolved
        .apply(base, { where: eq(records.category, 'keep') })
        .all()

      expect(rows.map((row) => row.id)).toEqual([3, 5, 6, 7, 9])
    } finally {
      fixture.sqlite.close()
    }
  })

  test('does not mutate requests or couple separate resolutions', () => {
    const orderBy = Object.freeze([
      Object.freeze({ field: 'score', direction: 'desc' as const }),
    ])
    const filters = Object.freeze([
      Object.freeze({
        type: 'condition' as const,
        field: 'category' as const,
        operator: 'eq' as const,
        value: 'keep',
      }),
    ])
    const request = Object.freeze({
      filters,
      orderBy,
      pagination: Object.freeze({ page: 1, size: 2 }),
    })

    const first = pageRecords.resolve(request)
    const second = pageRecords.resolve({ pagination: { page: 3, size: 4 } })

    expect(request).toEqual({
      filters: [
        {
          type: 'condition',
          field: 'category',
          operator: 'eq',
          value: 'keep',
        },
      ],
      orderBy: [{ field: 'score', direction: 'desc' }],
      pagination: { page: 1, size: 2 },
    })
    expect(first.pagination).toMatchObject({ size: 2, offset: 0, limit: 3 })
    expect(first.ordering.terms.map((term) => term.field)).toEqual([
      'score',
      'id',
    ])
    expect(second.pagination).toMatchObject({ size: 4, offset: 8, limit: 5 })
    expect(second.ordering.terms.map((term) => term.field)).toEqual(['id'])
  })

  test('ignores cursor bindings for page pagination', () => {
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic

    expect(() =>
      pageRecords.resolve({}, { cursorBinding: cyclic })
    ).not.toThrow()
  })
})
