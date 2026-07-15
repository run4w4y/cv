import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { defineRelations, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import {
  binaryFilterOperator,
  cursorPagination,
  defineQuery,
} from '../../index'

const accounts = sqliteTable('relational_renderer_accounts', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  score: integer('score').notNull(),
  tier: text('tier', { enum: ['bronze', 'silver', 'gold'] }).notNull(),
})

const notes = sqliteTable('relational_renderer_notes', {
  id: integer('id').primaryKey(),
  accountId: integer('account_id').notNull(),
  body: text('body').notNull(),
})

const relations = defineRelations({ accounts, notes }, (relation) => ({
  accounts: {
    notes: relation.many.notes({
      from: relation.accounts.id,
      to: relation.notes.accountId,
    }),
  },
  notes: {
    account: relation.one.accounts({
      from: relation.notes.accountId,
      to: relation.accounts.id,
      optional: false,
    }),
  },
}))

const accountListQuery = defineQuery(
  accounts,
  ({ col, expr }, root) => {
    const rootContains = binaryFilterOperator<'rootContains', string>(
      'rootContains',
      {
        compile: ({ value, bind }) =>
          sql`${root.name} like ${bind(`%${value}%`)}`,
      }
    )

    return [
      col.id.sortable({ unique: true }),
      col.name.filterable().sortable(),
      expr
        .number(sql<number>`${root.score} * 2`)
        .as('doubleScore')
        .filterable()
        .sortable(),
      expr
        .string(sql<string>`${root.name}`)
        .as('rootSearch')
        .filterable([rootContains]),
      expr
        .enum(sql<'bronze' | 'silver' | 'gold'>`${root.tier}`, [
          'gold',
          'silver',
          'bronze',
        ])
        .as('rankedTier')
        .sortable({ values: ['gold', 'silver', 'bronze'] }),
    ]
  },
  {
    pagination: cursorPagination({ defaultSize: 2, maxSize: 10 }),
    defaultOrderBy: [{ field: 'id', direction: 'asc' }],
  }
)

const sqlite = new Database(':memory:')
const database = drizzle({ client: sqlite, relations })

beforeAll(async () => {
  sqlite.exec(`
    create table relational_renderer_accounts (
      id integer primary key,
      name text not null,
      score integer not null,
      tier text not null
    );
    create table relational_renderer_notes (
      id integer primary key,
      account_id integer not null,
      body text not null
    );
  `)

  await database.insert(accounts).values([
    { id: 1, name: 'alpha', score: 10, tier: 'bronze' },
    { id: 2, name: 'beta', score: 20, tier: 'gold' },
    { id: 3, name: 'gamma', score: 15, tier: 'silver' },
  ])
  await database.insert(notes).values([
    { id: 1, accountId: 1, body: 'alpha-first' },
    { id: 2, accountId: 1, body: 'alpha-second' },
    { id: 3, accountId: 2, body: 'beta-only' },
  ])
})

afterAll(() => {
  sqlite.close()
})

const privateCursorKeys = (value: object): string[] =>
  Object.keys(value).filter((key) => key.startsWith('__drizzle_query_term_'))

describe('relational query rendering', () => {
  test('rebinds custom operators that close over the declared root', async () => {
    const relational = accountListQuery
      .resolve({
        filters: [
          {
            type: 'condition',
            field: 'rootSearch',
            operator: 'rootContains',
            value: 'alp',
          },
        ],
        pagination: { size: 10 },
      })
      .relational()
    const query = database.query.accounts.findMany({
      ...relational.config,
      columns: { id: true, name: true },
    })
    const built = query.toSQL()
    const rows = await query

    expect(built.sql).toMatch(/"d\d+"\."name" like \?/)
    expect(built.sql).not.toContain(
      '"relational_renderer_accounts"."name" like ?'
    )
    expect(built.params).toContain('%alp%')
    expect(rows.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 1, name: 'alpha' },
    ])
  })

  test('adds computed expressions only when selected and preserves consumer inference', async () => {
    const relational = accountListQuery
      .resolve({ pagination: { size: 10 } })
      .relational({ select: ['doubleScore'] as const })
    const query = database.query.accounts.findMany({
      ...relational.config,
      columns: { id: true, name: true },
      with: {
        notes: {
          columns: { body: true },
          orderBy: { id: 'asc' },
        },
      },
    })
    const rows = await query

    const typeContract = (row: (typeof rows)[number]): void => {
      const id: number = row.id
      const doubleScore: number = row.doubleScore
      const noteBody: string | undefined = row.notes[0]?.body
      void id
      void doubleScore
      void noteBody

      // @ts-expect-error `score` was excluded by the consumer's columns config.
      void row.score
      // @ts-expect-error Package-private cursor extras must not enter row inference.
      void row.__drizzle_query_term_0
    }
    void typeContract

    expect(
      rows.map(({ doubleScore, id, name, notes: accountNotes }) => ({
        doubleScore,
        id,
        name,
        notes: accountNotes.map(({ body }) => body),
      }))
    ).toEqual([
      {
        doubleScore: 20,
        id: 1,
        name: 'alpha',
        notes: ['alpha-first', 'alpha-second'],
      },
      {
        doubleScore: 40,
        id: 2,
        name: 'beta',
        notes: ['beta-only'],
      },
      { doubleScore: 30, id: 3, name: 'gamma', notes: [] },
    ])
  })

  test('uses private cursor extras at runtime and removes them while finalizing', async () => {
    const resolved = accountListQuery.resolve({
      orderBy: [{ field: 'name', direction: 'asc' }],
      pagination: { size: 2 },
    })
    const relational = resolved.relational()
    const query = database.query.accounts.findMany({
      ...relational.config,
      columns: { id: true, name: true },
    })
    const rows = await query

    const typeContract = (row: (typeof rows)[number]): void => {
      // @ts-expect-error Runtime cursor projections are intentionally private.
      void row.__drizzle_query_term_0
    }
    void typeContract

    expect(privateCursorKeys(relational.config.extras)).toEqual([
      '__drizzle_query_term_0',
      '__drizzle_query_term_1',
    ])
    expect(rows).toHaveLength(3)
    expect(
      rows.every((row) => privateCursorKeys(row as object).length === 2)
    ).toBe(true)

    const page = relational.finalize(rows)

    expect(page.items).toEqual([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
    ])
    expect(page.pageInfo.hasNextPage).toBe(true)
    expect(page.pageInfo.nextCursor).toEqual(expect.any(String))
    expect(page.items.every((row) => privateCursorKeys(row).length === 0)).toBe(
      true
    )

    const nextRelational = accountListQuery
      .resolve({
        orderBy: [{ field: 'name', direction: 'asc' }],
        pagination: {
          after: page.pageInfo.nextCursor ?? undefined,
          size: 2,
        },
      })
      .relational()
    const nextRows = await database.query.accounts.findMany({
      ...nextRelational.config,
      columns: { id: true, name: true },
    })

    expect(nextRelational.finalize(nextRows).items).toEqual([
      { id: 3, name: 'gamma' },
    ])
  })

  test('reuses a selected ordering expression as its cursor projection', async () => {
    const relational = accountListQuery
      .resolve({
        orderBy: [{ field: 'doubleScore', direction: 'desc' }],
        pagination: { size: 2 },
      })
      .relational({ select: ['doubleScore'] as const })
    const runtimeExtras = relational.config.extras as Record<string, unknown>

    expect(Object.keys(runtimeExtras)).toEqual([
      'doubleScore',
      '__drizzle_query_term_1',
    ])
    expect(runtimeExtras).not.toHaveProperty('__drizzle_query_term_0')

    const rows = await database.query.accounts.findMany({
      ...relational.config,
      columns: { id: true, name: true },
    })
    const page = relational.finalize(rows)

    expect(page.items).toEqual([
      { doubleScore: 40, id: 2, name: 'beta' },
      { doubleScore: 30, id: 3, name: 'gamma' },
    ])
    expect(page.pageInfo.nextCursor).toEqual(expect.any(String))
    expect(page.items[0]?.doubleScore).toBe(40)
    expect(privateCursorKeys(page.items[0] ?? {})).toEqual([])
  })

  test('keeps ranked enum cursor values separate from selected enum values', async () => {
    const relational = accountListQuery
      .resolve({
        orderBy: [{ field: 'rankedTier', direction: 'asc' }],
        pagination: { size: 2 },
      })
      .relational({ select: ['rankedTier'] as const })

    expect(Object.keys(relational.config.extras)).toEqual([
      'rankedTier',
      '__drizzle_query_term_0',
      '__drizzle_query_term_1',
    ])

    const firstRows = await database.query.accounts.findMany({
      ...relational.config,
      columns: { id: true },
    })
    const first = relational.finalize(firstRows)

    expect(first.items).toEqual([
      { id: 2, rankedTier: 'gold' },
      { id: 3, rankedTier: 'silver' },
    ])

    const secondRelational = accountListQuery
      .resolve({
        orderBy: [{ field: 'rankedTier', direction: 'asc' }],
        pagination: {
          after: first.pageInfo.nextCursor ?? undefined,
          size: 2,
        },
      })
      .relational({ select: ['rankedTier'] as const })
    const secondRows = await database.query.accounts.findMany({
      ...secondRelational.config,
      columns: { id: true },
    })

    expect(secondRelational.finalize(secondRows).items).toEqual([
      { id: 1, rankedTier: 'bronze' },
    ])
  })
})
