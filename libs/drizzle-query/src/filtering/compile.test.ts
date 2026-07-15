import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { asc, type SQL, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createColumnCatalog } from '../fields/columns'
import { compileFilters } from './compile'
import { binaryFilterOperator } from './operators/define'
import type { BinaryFilterOperatorCompileArguments } from './operators/types'
import type { FilterNode } from './types'

const records = sqliteTable('typed_filter_records', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  score: integer('score').notNull(),
  note: text('note'),
  payload: text('payload', { mode: 'json' })
    .$type<{ readonly kind: string }>()
    .notNull(),
})

const inspectedValues: unknown[] = []
const inspect = binaryFilterOperator('inspect', {
  compile: ({
    value,
  }: BinaryFilterOperatorCompileArguments<{ readonly nested: string }>) => {
    inspectedValues.push(value)
    return sql`1 = 1`
  },
})

const columns = createColumnCatalog(records)
const fields = [
  columns.id.filterable().runtime,
  columns.name.filterable().runtime,
  columns.score.filterable().runtime,
  columns.note.filterable().runtime,
  columns.payload.filterable([inspect]).runtime,
] as const

const sqlite = new Database(':memory:')
const db = drizzle({ client: sqlite })

beforeAll(async () => {
  sqlite.exec(`
    create table typed_filter_records (
      id integer primary key,
      name text not null,
      score integer not null,
      note text,
      payload text not null
    )
  `)
  await db.insert(records).values([
    { id: 1, name: 'alpha', score: 10, note: null, payload: { kind: 'lead' } },
    {
      id: 2,
      name: 'beta',
      score: 20,
      note: 'memo',
      payload: { kind: 'customer' },
    },
    {
      id: 3,
      name: 'alphabet',
      score: 30,
      note: '',
      payload: { kind: 'lead' },
    },
  ])
})

afterAll(() => {
  sqlite.close()
})

const matchingIds = async (where: SQL | undefined): Promise<number[]> => {
  const rows = await db
    .select({ id: records.id })
    .from(records)
    .where(where)
    .orderBy(asc(records.id))
    .all()
  return rows.map((row) => row.id)
}

const filterGroupTypeContracts = (): void => {
  const emptyAnd: FilterNode = {
    type: 'group',
    combinator: 'and',
    // @ts-expect-error Boolean groups must contain at least one child.
    children: [],
  }
  const emptyOr: FilterNode = {
    type: 'group',
    combinator: 'or',
    // @ts-expect-error Boolean groups must contain at least one child.
    children: [],
  }

  void emptyAnd
  void emptyOr
}

void filterGroupTypeContracts

describe('typed filter compilation', () => {
  test('dispatches binary operators and keeps RHS values bound', async () => {
    const compiled = compileFilters(fields, [
      {
        type: 'condition',
        field: 'score',
        operator: 'between',
        value: [15, 30],
      },
    ])
    const rendered = db
      .select({ id: records.id })
      .from(records)
      .where(compiled.where)
      .toSQL()

    expect(rendered.params).toEqual([15, 30])
    expect(await matchingIds(compiled.where)).toEqual([2, 3])
  })

  test('dispatches unary and nested group handlers', async () => {
    const filters = [
      {
        type: 'group',
        combinator: 'and',
        children: [
          {
            type: 'group',
            combinator: 'or',
            children: [
              {
                type: 'condition',
                field: 'name',
                operator: 'startsWith',
                value: 'alpha',
              },
              {
                type: 'condition',
                field: 'note',
                operator: 'isNull',
              },
            ],
          },
          {
            type: 'group',
            combinator: 'not',
            children: [
              {
                type: 'condition',
                field: 'score',
                operator: 'lt',
                value: 20,
              },
            ],
          },
        ],
      },
    ] as const satisfies readonly FilterNode[]

    expect(await matchingIds(compileFilters(fields, filters).where)).toEqual([
      3,
    ])
  })

  test('passes a typed RHS directly to consumer operators', () => {
    const value = { nested: 'original' }
    const compiled = compileFilters(fields, [
      {
        type: 'condition',
        field: 'payload',
        operator: 'inspect',
        value,
      },
    ])

    expect(compiled.where).toBeDefined()
    expect(inspectedValues.at(-1)).toBe(value)
  })
})
