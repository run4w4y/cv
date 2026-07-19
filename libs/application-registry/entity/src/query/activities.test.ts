import { describe, expect, test } from 'bun:test'
import { SQLiteDialect } from 'drizzle-orm/sqlite-core'

import { activityListQuery } from './activities'

const dialect = new SQLiteDialect()

describe('activity list query definition', () => {
  test('publishes inferred activity fields and timestamp operators', () => {
    expect(activityListQuery.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'revision', sortable: true }),
        expect.objectContaining({ name: 'occurredAt', sortable: true }),
        expect.objectContaining({ name: 'kind', sortable: true }),
        expect.objectContaining({ name: 'actor', sortable: true }),
        expect.objectContaining({ name: 'source', sortable: true }),
      ])
    )
  })

  test('compiles timestamp, kind, and revision filters as parameters', () => {
    const resolved = activityListQuery.resolve({
      filters: [
        { type: 'condition', field: 'revision', operator: 'gt', value: 10 },
        {
          type: 'condition',
          field: 'occurredAt',
          operator: 'gte',
          value: '2026-07-01T00:00:00.000Z',
        },
        {
          type: 'condition',
          field: 'kind',
          operator: 'in',
          value: ['status_changed', 'note_added'],
        },
      ],
      pagination: { size: 25 },
    })
    if (resolved.where === undefined) {
      throw new Error('Expected activity-list filters to produce a predicate.')
    }

    const rendered = dialect.sqlToQuery(resolved.where)
    expect(rendered.sql).toContain('"application_activities"."revision" > ?')
    expect(rendered.sql).toContain(
      '"application_activities"."occurred_at" >= ?'
    )
    expect(rendered.params).toEqual([
      10,
      '2026-07-01T00:00:00.000Z',
      'status_changed',
      'note_added',
    ])
  })
})
