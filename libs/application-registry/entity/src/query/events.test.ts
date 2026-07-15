import { describe, expect, test } from 'bun:test'
import { SQLiteDialect } from 'drizzle-orm/sqlite-core'

import { eventListQuery } from './events'

const dialect = new SQLiteDialect()

describe('event list query definition', () => {
  test('publishes inferred event fields and timestamp operators', () => {
    expect(eventListQuery.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'revision',
          filterOperatorInfo: expect.arrayContaining([
            expect.objectContaining({ name: 'eq' }),
            expect.objectContaining({ name: 'gt' }),
          ]),
          sortable: true,
        }),
        expect.objectContaining({
          name: 'occurredAt',
          filterOperatorInfo: expect.arrayContaining([
            expect.objectContaining({ name: 'gte' }),
            expect.objectContaining({ name: 'lte' }),
          ]),
          sortable: true,
        }),
        expect.objectContaining({
          name: 'kind',
          filterOperatorInfo: expect.arrayContaining([
            expect.objectContaining({ name: 'eq' }),
            expect.objectContaining({ name: 'in' }),
          ]),
        }),
      ])
    )
  })

  test('compiles generic timestamp, kind, and revision filters as parameters', () => {
    const resolved = eventListQuery.resolve({
      filters: [
        {
          type: 'condition',
          field: 'revision',
          operator: 'gt',
          value: 10,
        },
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
          value: ['stage_changed', 'research_updated'],
        },
      ],
      pagination: { size: 25 },
    })
    if (resolved.where === undefined) {
      throw new Error('Expected event-list filters to produce a predicate.')
    }

    const rendered = dialect.sqlToQuery(resolved.where)
    expect(rendered.sql).toContain('"application_events"."revision" > ?')
    expect(rendered.sql).toContain('"application_events"."occurred_at" >= ?')
    expect(rendered.params).toEqual([
      10,
      '2026-07-01T00:00:00.000Z',
      'stage_changed',
      'research_updated',
    ])
  })
})
