import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { QUERY_METADATA_KEY } from '../cursor/constants'
import {
  type BinaryFilterOperatorCompileArguments,
  binaryFilterOperator,
} from '../filtering/operators/index'
import { cursorPagination, defineQuery, pagePagination } from '../index'

const records = sqliteTable('query_expression_records', {
  id: integer('id').primaryKey(),
  score: integer('score').notNull(),
  priorityCode: text('priority_code'),
  occurredAt: text('occurred_at').notNull(),
  label: text('label').notNull(),
})

const seed: Array<typeof records.$inferInsert> = [
  {
    id: 1,
    score: 5,
    priorityCode: 'H',
    occurredAt: '2024-01-01T00:00:00.000Z',
    label: 'alpha',
  },
  {
    id: 2,
    score: 2,
    priorityCode: 'L',
    occurredAt: '2024-01-02T00:00:00.000Z',
    label: 'bb',
  },
  {
    id: 3,
    score: 4,
    priorityCode: null,
    occurredAt: '2024-01-03T00:00:00.000Z',
    label: 'charlie',
  },
  {
    id: 4,
    score: 1,
    priorityCode: 'H',
    occurredAt: '2024-01-04T00:00:00.000Z',
    label: 'dddd',
  },
  {
    id: 5,
    score: 3,
    priorityCode: 'L',
    occurredAt: '2024-01-05T00:00:00.000Z',
    label: 'e',
  },
  {
    id: 6,
    score: 6,
    priorityCode: null,
    occurredAt: '2024-01-06T00:00:00.000Z',
    label: 'foxtrot',
  },
]

const doubledScore = sql<number>`(${records.score} * 2)`

const numberQuery = defineQuery(
  records,
  ({ col, expr }) => [
    col.id.sortable({ unique: true }),
    expr.number(doubledScore).as('doubledScore').filterable().sortable(),
  ],
  { pagination: pagePagination({ defaultSize: 10, maxSize: 10 }) }
)

const priority = sql<'urgent' | 'normal'>`case
  when ${records.priorityCode} = 'H' then 'urgent'
  when ${records.priorityCode} = 'L' then 'normal'
  else null
end`

const priorityQuery = defineQuery(
  records,
  ({ col, expr }) => [
    col.id.sortable({ unique: true }),
    expr
      .enum(priority, ['urgent', 'normal'], { nullable: true })
      .as('priority')
      .filterable()
      .sortable({ values: ['urgent', 'normal'] }),
  ],
  { pagination: cursorPagination({ defaultSize: 2, maxSize: 10 }) }
)

const reversedPriorityQuery = defineQuery(
  records,
  ({ col, expr }) => [
    col.id.sortable({ unique: true }),
    expr
      .enum(priority, ['urgent', 'normal'], { nullable: true })
      .as('priority')
      .filterable()
      .sortable({ values: ['normal', 'urgent'] }),
  ],
  { pagination: cursorPagination({ defaultSize: 2, maxSize: 10 }) }
)

const storedPriority = sql<'urgent' | 'normal'>`${records.priorityCode}`

const boundPriorityQuery = defineQuery(
  records,
  ({ col, expr }) => [
    col.id.sortable({ unique: true }),
    expr
      .enum(storedPriority, ['urgent', 'normal'], {
        nullable: true,
        bind: (value) => sql.param(value === 'urgent' ? 'H' : 'L'),
      })
      .as('boundPriority')
      .sortable({ values: ['urgent', 'normal'] }),
  ],
  { pagination: cursorPagination({ defaultSize: 2, maxSize: 10 }) }
)

const occurredAt = sql`${records.occurredAt}`.mapWith(
  (value) => new Date(String(value))
)

const dateQuery = defineQuery(
  records,
  ({ col, expr }) => [
    col.id.sortable({ unique: true }),
    expr
      .date(occurredAt, {
        bind: (value) => sql.param(value.toISOString()),
      })
      .as('occurredAt')
      .filterable()
      .sortable(),
  ],
  { pagination: cursorPagination({ defaultSize: 2, maxSize: 10 }) }
)

const minimumLength = binaryFilterOperator('minimumLength', {
  compile: ({
    expression,
    value,
    bind,
  }: BinaryFilterOperatorCompileArguments<number>) =>
    sql`${expression} >= ${bind(value)}`,
})

const customQuery = defineQuery(
  records,
  ({ col, expr }) => [
    col.id.sortable({ unique: true }),
    expr
      .custom(sql<number>`length(${records.label})`)
      .as('labelLength')
      .filterable([minimumLength]),
  ],
  { pagination: pagePagination({ defaultSize: 10, maxSize: 10 }) }
)

const expressionTypeContracts = (): void => {
  defineQuery(
    records,
    ({ col, expr }) => [
      col.id.sortable({ unique: true }),
      // @ts-expect-error Custom expressions have no inferred filter operators.
      expr
        .custom(sql<number>`length(${records.label})`)
        .as('length')
        .filterable(),
    ],
    { pagination: pagePagination() }
  )

  defineQuery(
    records,
    ({ col, expr }) => [
      col.id.sortable({ unique: true }),
      // @ts-expect-error A number expression cannot use a string cursor type.
      expr.custom(sql<number>`length(${records.label})`, {
        cursor: { type: 'string' },
      }),
    ],
    { pagination: cursorPagination() }
  )

  defineQuery(
    records,
    ({ col, expr }) => [
      col.id.sortable({ unique: true }),
      expr.custom(sql<number>`length(${records.label})`, {
        cursor: {
          type: 'number',
          encode: (value) => value + 1,
        },
      }),
    ],
    { pagination: cursorPagination() }
  )
}

void expressionTypeContracts

const sqlite = new Database(':memory:')
const db = drizzle({ client: sqlite })

beforeAll(async () => {
  sqlite.exec(`
    create table query_expression_records (
      id integer primary key,
      score integer not null,
      priority_code text,
      occurred_at text not null,
      label text not null
    )
  `)
  await db.insert(records).values(seed).run()
})

afterAll(() => {
  sqlite.close()
})

const rawSqlOccurrences = (query: string, fragment: string): number =>
  query.split(fragment).length - 1

describe('typed computed expressions', () => {
  test('filters and orders by the raw number expression without projecting it', async () => {
    const resolved = numberQuery.resolve({
      filters: [
        {
          type: 'condition',
          field: 'doubledScore',
          operator: 'gte',
          value: 6,
        },
      ],
      orderBy: [{ field: 'doubledScore', direction: 'desc' }],
    })
    const applied = resolved.apply(
      db.select({ id: records.id }).from(records).$dynamic()
    )
    const built = applied.toSQL()
    const rows = await applied.all()

    expect(resolved.requiredSelection).toEqual({})
    expect(rawSqlOccurrences(built.sql, '"score" * 2')).toBe(2)
    expect(built.sql).not.toContain('doubledScore')
    expect(built.params).toEqual([6, 11])
    expect(rows).toEqual([{ id: 6 }, { id: 1 }, { id: 3 }, { id: 5 }])
    expect(Object.keys(rows[0] ?? {})).toEqual(['id'])
  })

  test('requires explicit operators for a custom expression', async () => {
    const resolved = customQuery.resolve({
      filters: [
        {
          type: 'condition',
          field: 'labelLength',
          operator: 'minimumLength',
          value: 5,
        },
      ],
    })
    const applied = resolved.apply(
      db.select({ id: records.id }).from(records).$dynamic()
    )
    const built = applied.toSQL()

    expect(built.sql).toContain(
      'length("query_expression_records"."label") >= ?'
    )
    expect(built.sql).not.toContain('labelLength')
    expect(await applied.all()).toEqual([{ id: 1 }, { id: 3 }, { id: 6 }])
  })
})

type CursorScenario = {
  readonly direction: 'asc' | 'desc'
  readonly nulls: 'first' | 'last'
  readonly expected: readonly number[]
}

const cursorScenarios: readonly CursorScenario[] = [
  {
    direction: 'asc',
    nulls: 'first',
    expected: [3, 6, 1, 4, 2, 5],
  },
  {
    direction: 'asc',
    nulls: 'last',
    expected: [1, 4, 2, 5, 3, 6],
  },
  {
    direction: 'desc',
    nulls: 'first',
    expected: [3, 6, 2, 5, 1, 4],
  },
  {
    direction: 'desc',
    nulls: 'last',
    expected: [2, 5, 1, 4, 3, 6],
  },
]

const requireCursor = (cursor: string | null): string => {
  if (cursor === null) {
    throw new Error('Expected another cursor.')
  }
  return cursor
}

const executePriority = (resolved: ReturnType<typeof priorityQuery.resolve>) =>
  resolved
    .apply(
      db
        .select({ id: records.id, ...resolved.requiredSelection })
        .from(records)
        .$dynamic()
    )
    .all()

describe('ranked nullable enum expressions', () => {
  test('filters using the raw enum expression', async () => {
    const resolved = priorityQuery.resolve({
      filters: [
        {
          type: 'condition',
          field: 'priority',
          operator: 'eq',
          value: 'urgent',
        },
      ],
      pagination: { size: 10 },
    })
    const applied = resolved.apply(
      db
        .select({ id: records.id, ...resolved.requiredSelection })
        .from(records)
        .$dynamic()
    )
    const built = applied.toSQL()
    const page = resolved.finalize(await applied.all())

    expect(built.sql).toContain(
      'when "query_expression_records"."priority_code" = \'H\''
    )
    expect(built.sql).not.toContain('"priority" = ?')
    expect(page.items).toEqual([{ id: 1 }, { id: 4 }])
  })

  test('invalidates cursors when the enum ranking changes', async () => {
    const first = priorityQuery.resolve({
      orderBy: [
        {
          field: 'priority',
          direction: 'asc',
          nulls: 'last',
        },
      ],
      pagination: { size: 1 },
    })
    const cursor = requireCursor(
      first.finalize(await executePriority(first)).pageInfo.nextCursor
    )
    try {
      reversedPriorityQuery.resolve({
        orderBy: [
          {
            field: 'priority',
            direction: 'asc',
            nulls: 'last',
          },
        ],
        pagination: { size: 1, after: cursor },
      })
      throw new Error('Expected the cursor to be rejected.')
    } catch (cause) {
      expect(cause).toMatchObject({ code: 'cursor-mismatch' })
    }
  })

  test('inlines definition values after applying an explicit driver binder', async () => {
    const first = boundPriorityQuery.resolve({
      orderBy: [{ field: 'boundPriority', nulls: 'last' }],
      pagination: { size: 2 },
    })
    const firstQuery = first.apply(
      db
        .select({ id: records.id, ...first.requiredSelection })
        .from(records)
        .$dynamic()
    )
    const firstStatement = firstQuery.toSQL()
    const firstPage = first.finalize(await firstQuery.all())

    expect(firstStatement.sql).toContain("when 'H' then 0")
    expect(firstStatement.sql).toContain("when 'L' then 1")
    expect(firstStatement.sql).not.toContain('? then ?')
    expect(firstStatement.params).toEqual([3])
    expect(firstPage.items).toEqual([{ id: 1 }, { id: 4 }])

    const after = requireCursor(firstPage.pageInfo.nextCursor)
    const second = boundPriorityQuery.resolve({
      orderBy: [{ field: 'boundPriority', nulls: 'last' }],
      pagination: { size: 2, after },
    })
    const secondStatement = second
      .apply(
        db
          .select({ id: records.id, ...second.requiredSelection })
          .from(records)
          .$dynamic()
      )
      .toSQL()

    expect(secondStatement.params).toEqual([0, 0, 4, 3])
  })

  for (const scenario of cursorScenarios) {
    test(`${scenario.direction}, nulls ${scenario.nulls} traverses a custom enum rank`, async () => {
      const visited: number[] = []
      let after: string | undefined

      for (let pageIndex = 0; pageIndex <= seed.length; pageIndex += 1) {
        const resolved = priorityQuery.resolve({
          orderBy: [
            {
              field: 'priority',
              direction: scenario.direction,
              nulls: scenario.nulls,
            },
          ],
          pagination: {
            size: 2,
            ...(after === undefined ? {} : { after }),
          },
        })
        const rows = await executePriority(resolved)
        const page = resolved.finalize(rows)

        expect(Object.hasOwn(rows[0] ?? {}, QUERY_METADATA_KEY)).toBe(true)
        expect(Object.hasOwn(page.items[0] ?? {}, QUERY_METADATA_KEY)).toBe(
          false
        )
        expect(Object.keys(page.items[0] ?? {})).toEqual(['id'])

        visited.push(...page.items.map((row) => row.id))
        if (!page.pageInfo.hasNextPage) {
          break
        }
        after = requireCursor(page.pageInfo.nextCursor)
      }

      expect(visited).toEqual([...scenario.expected])
      expect(new Set(visited).size).toBe(seed.length)
    })
  }
})

const executeDates = (resolved: ReturnType<typeof dateQuery.resolve>) =>
  resolved
    .apply(
      db
        .select({ id: records.id, ...resolved.requiredSelection })
        .from(records)
        .$dynamic()
    )
    .all()

describe('date expressions with a driver binder', () => {
  test('uses the explicit binder for filters and cursor seek values', async () => {
    const threshold = new Date('2024-01-02T00:00:00.000Z')
    const first = dateQuery.resolve({
      filters: [
        {
          type: 'condition',
          field: 'occurredAt',
          operator: 'gte',
          value: threshold,
        },
      ],
      orderBy: [{ field: 'occurredAt', direction: 'asc' }],
      pagination: { size: 2 },
    })
    const firstRows = await executeDates(first)
    const firstRow = firstRows[0] as Record<string, unknown> | undefined
    const firstMetadata = firstRow?.[QUERY_METADATA_KEY] as
      | Record<string, unknown>
      | undefined

    expect(firstMetadata?.__drizzle_query_term_0).toBeInstanceOf(Date)

    const firstPage = first.finalize(firstRows)
    expect(firstPage.items).toEqual([{ id: 2 }, { id: 3 }])

    const second = dateQuery.resolve({
      filters: [
        {
          type: 'condition',
          field: 'occurredAt',
          operator: 'gte',
          value: new Date(threshold),
        },
      ],
      orderBy: [{ field: 'occurredAt', direction: 'asc' }],
      pagination: {
        size: 2,
        after: requireCursor(firstPage.pageInfo.nextCursor),
      },
    })
    const applied = second.apply(
      db
        .select({ id: records.id, ...second.requiredSelection })
        .from(records)
        .$dynamic()
    )
    const built = applied.toSQL()

    expect(built.params).toContain('2024-01-02T00:00:00.000Z')
    expect(built.params).toContain('2024-01-03T00:00:00.000Z')
    expect(built.params.some((value) => value instanceof Date)).toBe(false)
    expect(built.sql).not.toContain('occurredAt')
    expect(second.finalize(await applied.all()).items).toEqual([
      { id: 4 },
      { id: 5 },
    ])
  })
})
