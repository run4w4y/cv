import { describe, expect, test } from 'bun:test'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { QueryError } from '../error'
import { createColumnCatalog } from './columns'

const records = sqliteTable('sortable_option_validation_records', {
  id: integer('id').primaryKey(),
  status: text('status', { enum: ['active', 'archived'] }).notNull(),
})

const columns = createColumnCatalog(records)

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
})
