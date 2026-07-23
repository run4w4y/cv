import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  integer,
  SQLiteDialect,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { CURSOR_EXTRA_PREFIX } from '../cursor/constants'
import { QueryError } from '../error'
import { cursorPagination, defineQuery } from '../index'
import { createColumnCatalog } from './columns'

const records = sqliteTable('sortable_option_validation_records', {
  id: integer('id').primaryKey(),
  status: text('status', { enum: ['active', 'archived'] }).notNull(),
})

const columns = createColumnCatalog(records)

const exoticStatuses = [
  'plain',
  "manager's choice",
  "path\\manager's choice",
  'nul\u0000byte',
  'control\u001abyte',
] as const

const exoticRecords = sqliteTable('exotic_sortable_records', {
  id: integer('id').primaryKey(),
  status: text('status', { enum: exoticStatuses }),
})

const applicationStatuses = [
  'wishlist',
  'ready',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'on_hold',
  'closed',
  'unknown',
] as const

const applications = sqliteTable('sortable_parameter_applications', {
  id: integer('id').primaryKey(),
  status: text('status', { enum: applicationStatuses }),
})

const applicationQuery = defineQuery(
  applications,
  ({ col }) => [
    col.id.sortable({ unique: true }),
    col.status.sortable({ values: applicationStatuses }),
  ],
  { pagination: cursorPagination({ defaultSize: 1, maxSize: 10 }) }
)

const expectDefinitionError = (evaluate: () => unknown, path: string): void => {
  try {
    evaluate()
    throw new Error('Expected a QueryError.')
  } catch (cause) {
    expect(cause).toBeInstanceOf(QueryError)
    expect((cause as QueryError).code).toBe('invalid-definition')
    expect((cause as QueryError).path).toBe(path)
  }
}

describe('sortable field validation', () => {
  test('keeps sortable options statically typed', () => {
    const assertSortableOptionTypes = (): void => {
      // @ts-expect-error sortable options are typed rather than parsed at runtime
      columns.id.sortable(null)
      // @ts-expect-error unknown sortable options are rejected by TypeScript
      columns.id.sortable({ unexpected: true })
      // @ts-expect-error unique must be a boolean
      columns.id.sortable({ unique: 'yes' })
      // @ts-expect-error null placement has a closed union
      columns.id.sortable({ nulls: 'middle' })
      // @ts-expect-error enum rank tuples are statically non-empty
      columns.status.sortable({ values: [] })
      // @ts-expect-error enum ranks use values inferred from the column
      columns.status.sortable({ values: ['active', 1] })
    }

    expect(assertSortableOptionTypes).toBeFunction()
    expect(
      columns.id.sortable({ unique: true, nulls: 'first' }).runtime.sort
    ).toMatchObject({ unique: true, defaultNulls: 'first' })
  })

  test('rejects duplicate enum ranks, which types cannot express', () => {
    expectDefinitionError(
      () => columns.status.sortable({ values: ['active', 'active'] }),
      'fields.status.sortable.values'
    )
  })

  test('rejects enabling sorting twice', () => {
    expectDefinitionError(
      () => columns.id.sortable().sortable(),
      'fields.id.sortable'
    )
  })

  test('keeps production-like enum labels and ranks parameter-free', () => {
    const sort = createColumnCatalog(applications).status.sortable({
      values: applicationStatuses,
    }).runtime.sort

    if (sort === undefined) throw new Error('Expected a sortable runtime.')

    const dialects = [new SQLiteDialect(), new PgDialect(), new MySqlDialect()]
    for (const dialect of dialects) {
      const rendered = dialect.sqlToQuery(sql`select ${sort.expression}`)

      expect(rendered.params).toEqual([])
      expect(rendered.sql.toLowerCase()).toContain('else case ')
      expect(rendered.sql).toContain("when 'wishlist' then 0")
      expect(rendered.sql).toContain("when 'unknown' then 11")
    }
  })

  test('binds MySQL-sensitive enum labels on every dialect', () => {
    const sort = createColumnCatalog(exoticRecords).status.sortable({
      values: exoticStatuses,
    }).runtime.sort

    if (sort === undefined) throw new Error('Expected a sortable runtime.')

    const dialects = [new SQLiteDialect(), new PgDialect(), new MySqlDialect()]
    for (const dialect of dialects) {
      const rendered = dialect.sqlToQuery(sql`select ${sort.expression}`)

      expect(rendered.params).toEqual(exoticStatuses.slice(2))
      expect(rendered.sql.toLowerCase()).toContain('else case ')
      expect(rendered.sql).toContain("manager''s choice")
      for (const unsafe of exoticStatuses.slice(2)) {
        expect(rendered.sql).not.toContain(unsafe)
      }
      expect(rendered.sql).toContain('then 0')
      expect(rendered.sql).toContain('then 4')
      expect(rendered.sql).toContain('else 5')
    }
  })

  test('keeps nulls and assigns the fallback rank to unknown database values', async () => {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      create table exotic_sortable_records (
        id integer primary key,
        status text
      )
    `)

    try {
      const database = drizzle({ client: sqlite })
      await database
        .insert(exoticRecords)
        .values([
          ...exoticStatuses.map((status, index) => ({ id: index + 1, status })),
          { id: 6, status: null },
        ])
      sqlite
        .query('insert into exotic_sortable_records (id, status) values (?, ?)')
        .run(7, 'not-in-the-definition')

      const sort = createColumnCatalog(exoticRecords).status.sortable({
        values: exoticStatuses,
      }).runtime.sort
      if (sort === undefined) throw new Error('Expected a sortable runtime.')

      const rows = await database
        .select({ id: exoticRecords.id, rank: sort.selection('rank') })
        .from(exoticRecords)
        .orderBy(exoticRecords.id)

      expect(rows).toEqual([
        { id: 1, rank: 0 },
        { id: 2, rank: 1 },
        { id: 3, rank: 2 },
        { id: 4, rank: 3 },
        { id: 5, rank: 4 },
        { id: 6, rank: null },
        { id: 7, rank: 5 },
      ])
    } finally {
      sqlite.close()
    }
  })

  test('keeps a 12-value enum continuation below the SQLite parameter budget', async () => {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      create table sortable_parameter_applications (
        id integer primary key,
        status text
      )
    `)

    try {
      const database = drizzle({ client: sqlite })
      await database.insert(applications).values([
        { id: 1, status: 'wishlist' },
        { id: 2, status: 'ready' },
        { id: 3, status: null },
      ])

      const first = applicationQuery.resolve({
        orderBy: [{ field: 'status', nulls: 'last' }],
        pagination: { size: 1 },
      })
      const firstRows = await first
        .apply(
          database
            .select({ id: applications.id, ...first.requiredSelection })
            .from(applications)
            .$dynamic()
        )
        .all()
      const after = first.finalize(firstRows).pageInfo.nextCursor
      if (after === null) throw new Error('Expected a continuation cursor.')

      const second = applicationQuery.resolve({
        orderBy: [{ field: 'status', nulls: 'last' }],
        pagination: { size: 1, after },
      })
      const statement = second
        .apply(
          database
            .select({ id: applications.id, ...second.requiredSelection })
            .from(applications)
            .$dynamic()
        )
        .toSQL()

      expect(statement.params).toEqual([0, 0, 1, 2])
      expect(statement.params).toHaveLength(4)
      expect(statement.sql).not.toContain(`? then ?`)
      expect(statement.sql).toContain(CURSOR_EXTRA_PREFIX)
    } finally {
      sqlite.close()
    }
  })
})
