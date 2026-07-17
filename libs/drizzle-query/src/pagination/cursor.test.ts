import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { QUERY_METADATA_KEY } from '../cursor/constants'
import {
  cursorPagination,
  defineQuery,
  type OrderRequest,
  QueryError,
} from '../index'

const records = sqliteTable('records', {
  id: integer('id').primaryKey(),
  category: text('category').notNull(),
  score: integer('score'),
})

const scopedRecords = sqliteTable('scoped_records', {
  tenant: text('tenant').notNull(),
  sequence: integer('sequence').notNull(),
  category: text('category').notNull(),
  score: integer('score').notNull(),
})

const nullableCompositeRecords = sqliteTable('nullable_composite_records', {
  id: integer('id').primaryKey(),
  bucket: text('bucket'),
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

const cursorRecords = defineQuery(
  records,
  ({ col }) => [
    col.id.sortable({ unique: true }),
    col.category.filterable(),
    col.score.sortable(),
  ],
  { pagination: cursorPagination({ defaultSize: 2, maxSize: 10 }) }
)

const compositeCursorRecords = defineQuery(
  scopedRecords,
  ({ col }) => [
    col.tenant.sortable(),
    col.sequence.sortable(),
    col.category.sortable(),
    col.score.sortable(),
  ],
  {
    pagination: cursorPagination({ defaultSize: 2, maxSize: 10 }),
    uniqueBy: [['tenant', 'sequence']],
  }
)

const nullableCompositeCursorRecords = defineQuery(
  nullableCompositeRecords,
  ({ col }) => [
    col.id.sortable({ unique: true }),
    col.bucket.sortable(),
    col.score.sortable(),
  ],
  { pagination: cursorPagination({ defaultSize: 1, maxSize: 10 }) }
)

const cursorTypeContracts = (): void => {
  // @ts-expect-error Cursor pagination does not accept a page number.
  cursorRecords.resolve({ pagination: { page: 1 } })
  cursorRecords.resolve({
    // @ts-expect-error Filtering a field does not make it sortable.
    orderBy: [{ field: 'category' }],
  })
}

void cursorTypeContracts

const requireCursor = (cursor: string | null): string => {
  if (cursor === null) {
    throw new Error('Expected a cursor for a non-empty page.')
  }
  return cursor
}

const executeCursor = async (
  fixture: Awaited<ReturnType<typeof makeFixture>>,
  resolved: ReturnType<typeof cursorRecords.resolve>
) => {
  const base = fixture.db
    .select({
      id: records.id,
      category: records.category,
      score: records.score,
      ...resolved.requiredSelection,
    })
    .from(records)
    .$dynamic()

  return resolved.apply(base).all()
}

const cursorScenarios = [
  { direction: 'asc', nulls: 'first' },
  { direction: 'asc', nulls: 'last' },
  { direction: 'desc', nulls: 'first' },
  { direction: 'desc', nulls: 'last' },
] as const

const nullableCompositeRows: (typeof nullableCompositeRecords.$inferSelect)[] =
  [
    { id: 1, bucket: null, score: null },
    { id: 2, bucket: null, score: 1 },
    { id: 3, bucket: null, score: 2 },
    { id: 4, bucket: 'alpha', score: null },
    { id: 5, bucket: 'alpha', score: 1 },
    { id: 6, bucket: 'alpha', score: 1 },
    { id: 7, bucket: 'alpha', score: 2 },
    { id: 8, bucket: 'beta', score: null },
    { id: 9, bucket: 'beta', score: 1 },
    { id: 10, bucket: 'beta', score: 2 },
  ]

const compareNullableValues = (
  left: string | number | null,
  right: string | number | null,
  direction: 'asc' | 'desc',
  nulls: 'first' | 'last'
): number => {
  if (left === right) return 0
  if (left === null) return nulls === 'first' ? -1 : 1
  if (right === null) return nulls === 'first' ? 1 : -1

  const comparison = left < right ? -1 : 1
  return direction === 'asc' ? comparison : -comparison
}

const expectedNullableCompositeIds = (
  bucketOrder: (typeof cursorScenarios)[number],
  scoreOrder: (typeof cursorScenarios)[number]
): number[] =>
  [...nullableCompositeRows]
    .sort(
      (left, right) =>
        compareNullableValues(
          left.bucket ?? null,
          right.bucket ?? null,
          bucketOrder.direction,
          bucketOrder.nulls
        ) ||
        compareNullableValues(
          left.score ?? null,
          right.score ?? null,
          scoreOrder.direction,
          scoreOrder.nulls
        ) ||
        left.id - right.id
    )
    .map((row) => row.id)

const expectedIds = (
  direction: 'asc' | 'desc',
  nulls: 'first' | 'last'
): number[] =>
  [...fixtureRows]
    .sort((left, right) => {
      if (left.score === right.score) {
        // The automatically appended unique id tie-breaker is ascending.
        return left.id - right.id
      }
      if (left.score === null) {
        return nulls === 'first' ? -1 : 1
      }
      if (right.score === null) {
        return nulls === 'first' ? 1 : -1
      }
      return direction === 'asc'
        ? left.score - right.score
        : right.score - left.score
    })
    .map((row) => row.id)

describe('cursor pagination', () => {
  test('traverses an ordering made deterministic by a composite unique tuple', async () => {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      create table scoped_records (
        tenant text not null,
        sequence integer not null,
        category text not null,
        score integer not null
      )
    `)
    const db = drizzle({ client: sqlite })
    const rows: (typeof scopedRecords.$inferInsert)[] = [
      { tenant: 'beta', sequence: 2, category: 'blue', score: 10 },
      { tenant: 'alpha', sequence: 2, category: 'blue', score: 10 },
      { tenant: 'beta', sequence: 1, category: 'amber', score: 10 },
      { tenant: 'alpha', sequence: 1, category: 'blue', score: 5 },
      { tenant: 'alpha', sequence: 3, category: 'amber', score: 10 },
    ]

    try {
      await db.insert(scopedRecords).values(rows)
      const visited: string[] = []
      let after: string | undefined

      for (let pageIndex = 0; pageIndex <= rows.length; pageIndex += 1) {
        const resolved = compositeCursorRecords.resolve({
          orderBy: [{ field: 'score' }],
          pagination: {
            size: 2,
            ...(after === undefined ? {} : { after }),
          },
        })

        expect(resolved.ordering.terms.map((term) => term.field)).toEqual([
          'score',
          'tenant',
          'sequence',
        ])

        const query = db
          .select({
            tenant: scopedRecords.tenant,
            sequence: scopedRecords.sequence,
            score: scopedRecords.score,
            ...resolved.requiredSelection,
          })
          .from(scopedRecords)
          .$dynamic()
        const page = resolved.finalize(await resolved.apply(query).all())
        visited.push(
          ...page.items.map(
            (row) => `${row.score}:${row.tenant}:${row.sequence}`
          )
        )

        if (!page.pageInfo.hasNextPage) {
          break
        }
        after = requireCursor(page.pageInfo.nextCursor)
      }

      expect(visited).toEqual([
        '5:alpha:1',
        '10:alpha:2',
        '10:alpha:3',
        '10:beta:1',
        '10:beta:2',
      ])
      expect(new Set(visited).size).toBe(rows.length)
    } finally {
      sqlite.close()
    }
  })

  test('traverses a mixed-direction four-term ordering exactly once', async () => {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      create table scoped_records (
        tenant text not null,
        sequence integer not null,
        category text not null,
        score integer not null
      )
    `)
    const db = drizzle({ client: sqlite })
    const rows: (typeof scopedRecords.$inferInsert)[] = [
      { tenant: 'beta', sequence: 2, category: 'blue', score: 10 },
      { tenant: 'alpha', sequence: 2, category: 'blue', score: 10 },
      { tenant: 'beta', sequence: 1, category: 'amber', score: 10 },
      { tenant: 'alpha', sequence: 1, category: 'blue', score: 5 },
      { tenant: 'alpha', sequence: 3, category: 'amber', score: 10 },
    ]

    try {
      await db.insert(scopedRecords).values(rows)
      const visited: string[] = []
      let after: string | undefined

      for (let pageIndex = 0; pageIndex <= rows.length; pageIndex += 1) {
        const resolved = compositeCursorRecords.resolve({
          orderBy: [
            { field: 'category', direction: 'desc' },
            { field: 'score', direction: 'asc' },
          ],
          pagination: {
            size: 1,
            ...(after === undefined ? {} : { after }),
          },
        })

        expect(resolved.ordering.terms.map((term) => term.field)).toEqual([
          'category',
          'score',
          'tenant',
          'sequence',
        ])

        const query = db
          .select({
            tenant: scopedRecords.tenant,
            sequence: scopedRecords.sequence,
            category: scopedRecords.category,
            score: scopedRecords.score,
            ...resolved.requiredSelection,
          })
          .from(scopedRecords)
          .$dynamic()
        const page = resolved.finalize(await resolved.apply(query).all())
        visited.push(
          ...page.items.map(
            (row) =>
              `${row.category}:${row.score}:${row.tenant}:${row.sequence}`
          )
        )

        if (!page.pageInfo.hasNextPage) break
        after = requireCursor(page.pageInfo.nextCursor)
      }

      expect(visited).toEqual([
        'blue:5:alpha:1',
        'blue:10:alpha:2',
        'blue:10:beta:2',
        'amber:10:alpha:3',
        'amber:10:beta:1',
      ])
      expect(new Set(visited).size).toBe(rows.length)
    } finally {
      sqlite.close()
    }
  })

  for (const bucketOrder of cursorScenarios) {
    for (const scoreOrder of cursorScenarios) {
      test(`traverses two nullable terms exactly once: bucket ${bucketOrder.direction}/${bucketOrder.nulls}, score ${scoreOrder.direction}/${scoreOrder.nulls}`, async () => {
        const sqlite = new Database(':memory:')
        sqlite.exec(`
          create table nullable_composite_records (
            id integer primary key not null,
            bucket text,
            score integer
          )
        `)
        const db = drizzle({ client: sqlite })
        const visited: number[] = []
        let after: string | undefined

        try {
          await db
            .insert(nullableCompositeRecords)
            .values(nullableCompositeRows)

          for (
            let pageIndex = 0;
            pageIndex <= nullableCompositeRows.length;
            pageIndex += 1
          ) {
            const resolved = nullableCompositeCursorRecords.resolve({
              orderBy: [
                {
                  field: 'bucket',
                  direction: bucketOrder.direction,
                  nulls: bucketOrder.nulls,
                },
                {
                  field: 'score',
                  direction: scoreOrder.direction,
                  nulls: scoreOrder.nulls,
                },
              ],
              pagination: {
                size: 1,
                ...(after === undefined ? {} : { after }),
              },
            })
            const query = db
              .select({
                id: nullableCompositeRecords.id,
                bucket: nullableCompositeRecords.bucket,
                score: nullableCompositeRecords.score,
                ...resolved.requiredSelection,
              })
              .from(nullableCompositeRecords)
              .$dynamic()
            const page = resolved.finalize(await resolved.apply(query).all())

            visited.push(...page.items.map((row) => row.id))
            if (!page.pageInfo.hasNextPage) break
            after = requireCursor(page.pageInfo.nextCursor)
          }

          expect(visited).toEqual(
            expectedNullableCompositeIds(bucketOrder, scoreOrder)
          )
          expect(visited).toHaveLength(nullableCompositeRows.length)
          expect(new Set(visited).size).toBe(nullableCompositeRows.length)
        } finally {
          sqlite.close()
        }
      })
    }
  }

  for (const scenario of cursorScenarios) {
    test(`${scenario.direction} with nulls ${scenario.nulls} traverses each row once`, async () => {
      const fixture = await makeFixture()
      const visited: number[] = []
      let after: string | undefined

      try {
        for (
          let pageIndex = 0;
          pageIndex <= fixtureRows.length;
          pageIndex += 1
        ) {
          const resolved = cursorRecords.resolve({
            orderBy: [
              {
                field: 'score',
                direction: scenario.direction,
                nulls: scenario.nulls,
              },
            ],
            pagination: {
              size: 2,
              ...(after === undefined ? {} : { after }),
            },
          })

          expect(resolved.pagination.limit).toBe(3)
          expect(resolved.pagination.offset).toBeUndefined()
          expect(resolved.ordering.terms).toMatchObject([
            {
              field: 'score',
              direction: scenario.direction,
              nulls: scenario.nulls,
              source: 'request',
            },
            {
              field: 'id',
              direction: 'asc',
              source: 'tie-breaker',
              unique: true,
              nullable: false,
            },
          ])

          const rows = await executeCursor(fixture, resolved)
          const page = resolved.finalize(rows)
          visited.push(...page.items.map((row) => row.id))
          expect(page.pageInfo.hasPreviousPage).toBe(after !== undefined)
          if (!page.pageInfo.hasNextPage) {
            expect(page.pageInfo.nextCursor).toBeNull()
            break
          }
          after = requireCursor(page.pageInfo.nextCursor)
        }

        expect(visited).toEqual(expectedIds(scenario.direction, scenario.nulls))
        expect(new Set(visited).size).toBe(fixtureRows.length)
      } finally {
        fixture.sqlite.close()
      }
    })
  }

  test('uses a nested hidden selection for cursors and strips it from finalized items', async () => {
    const fixture = await makeFixture()

    try {
      const resolved = cursorRecords.resolve({
        orderBy: [{ field: 'score', nulls: 'first' }],
        pagination: { size: 2 },
      })

      expect(Object.keys(resolved.requiredSelection)).toEqual([
        QUERY_METADATA_KEY,
      ])
      expect(
        Object.keys(resolved.requiredSelection[QUERY_METADATA_KEY] ?? {})
      ).toEqual(['__drizzle_query_term_0', '__drizzle_query_term_1'])

      const rows = await executeCursor(fixture, resolved)
      expect(Object.hasOwn(rows[0] ?? {}, QUERY_METADATA_KEY)).toBe(true)
      const firstRow = rows[0] as Record<string, unknown> | undefined
      expect(firstRow?.[QUERY_METADATA_KEY]).toEqual({
        __drizzle_query_term_0: null,
        __drizzle_query_term_1: 1,
      })

      const page = resolved.finalize(rows)
      expect(Object.hasOwn(page.items[0] ?? {}, QUERY_METADATA_KEY)).toBe(false)
      expect(page.items[0]).toEqual({ id: 1, category: 'keep', score: null })
      expect(page.pageInfo.nextCursor).toBeString()
    } finally {
      fixture.sqlite.close()
    }
  })

  test('rejects malformed, filter-stale, and order-stale cursors', async () => {
    const fixture = await makeFixture()

    try {
      expect(() =>
        cursorRecords.resolve({ pagination: { after: 'not-base64!' } })
      ).toThrow(QueryError)

      try {
        cursorRecords.resolve({ pagination: { after: 'not-base64!' } })
        throw new Error('Expected a malformed cursor error.')
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError)
        expect((error as QueryError).code).toBe('invalid-cursor')
        expect((error as QueryError).path).toBe('pagination.after')
      }

      const source = cursorRecords.resolve({
        filters: [
          {
            type: 'condition',
            field: 'category',
            operator: 'eq',
            value: 'keep',
          },
        ],
        orderBy: [{ field: 'score', direction: 'asc', nulls: 'last' }],
        pagination: { size: 2 },
      })
      const sourceRows = await executeCursor(fixture, source)
      const token = requireCursor(
        source.finalize(sourceRows).pageInfo.nextCursor
      )

      const staleFilter = () =>
        cursorRecords.resolve({
          filters: [
            {
              type: 'condition',
              field: 'category',
              operator: 'eq',
              value: 'drop',
            },
          ],
          orderBy: [{ field: 'score', direction: 'asc', nulls: 'last' }],
          pagination: { size: 2, after: token },
        })
      const staleOrder = () =>
        cursorRecords.resolve({
          filters: [
            {
              type: 'condition',
              field: 'category',
              operator: 'eq',
              value: 'keep',
            },
          ],
          orderBy: [{ field: 'score', direction: 'desc', nulls: 'last' }],
          pagination: { size: 2, after: token },
        })

      for (const compile of [staleFilter, staleOrder]) {
        try {
          compile()
          throw new Error('Expected a cursor mismatch.')
        } catch (error) {
          expect(error).toBeInstanceOf(QueryError)
          expect((error as QueryError).code).toBe('cursor-mismatch')
          expect((error as QueryError).path).toBe('pagination.after')
        }
      }
    } finally {
      fixture.sqlite.close()
    }
  })

  test('binds cursors to consumer-owned query constraints', async () => {
    const fixture = await makeFixture()
    const orderBy = [
      { field: 'score', direction: 'asc', nulls: 'last' },
    ] as const satisfies readonly OrderRequest<'score'>[]

    try {
      const source = cursorRecords.resolve(
        { orderBy, pagination: { size: 2 } },
        { cursorBinding: { tenant: 'alpha', revision: 7 } }
      )
      const token = requireCursor(
        source.finalize(await executeCursor(fixture, source)).pageInfo
          .nextCursor
      )

      expect(() =>
        cursorRecords.resolve(
          { orderBy, pagination: { size: 2, after: token } },
          { cursorBinding: { tenant: 'alpha', revision: 7 } }
        )
      ).not.toThrow()

      try {
        cursorRecords.resolve(
          { orderBy, pagination: { size: 2, after: token } },
          { cursorBinding: { tenant: 'beta', revision: 7 } }
        )
        throw new Error('Expected a cursor binding mismatch.')
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError)
        expect((error as QueryError).code).toBe('cursor-mismatch')
      }
    } finally {
      fixture.sqlite.close()
    }
  })
})
