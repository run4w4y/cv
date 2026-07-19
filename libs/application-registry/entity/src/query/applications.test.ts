import { describe, expect, test } from 'bun:test'
import { alias, SQLiteDialect } from 'drizzle-orm/sqlite-core'

import { applications } from '../tables/applications'
import { applicationListQuery } from './applications'

const dialect = new SQLiteDialect()
const referenceTime = '2026-07-12T12:00:00.000Z'

const renderWhere = (
  request: Parameters<typeof applicationListQuery.resolve>[0]
) => {
  const resolved = applicationListQuery.resolve(request)
  if (resolved.where === undefined) {
    throw new Error('Expected the application-list query to have a predicate.')
  }
  return dialect.sqlToQuery(resolved.where)
}

describe('application list query definition', () => {
  test('publishes inferred scalar, relation, and computed capabilities', () => {
    expect(
      applicationListQuery.fields.some(
        ({ name }) => name === 'companyNormalized'
      )
    ).toBe(false)
    const fieldNames = new Set(
      applicationListQuery.fields.map(({ name }) => name)
    )
    for (const removed of [
      'category',
      'details',
      'fitScore',
      'openStatus',
      'recommendedAction',
      'remotePolicy',
      'researchPriority',
      'sourceConfidence',
      'technologyStack',
    ]) {
      expect(fieldNames.has(removed)).toBe(false)
    }
    expect(applicationListQuery.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'applicationStatus',
          filterOperatorInfo: expect.arrayContaining([
            expect.objectContaining({ name: 'eq' }),
            expect.objectContaining({ name: 'in' }),
          ]),
          sortable: true,
        }),
        expect.objectContaining({
          name: 'company',
          filterOperatorInfo: expect.arrayContaining([
            expect.objectContaining({
              name: 'contains',
              value: { type: 'string' },
            }),
          ]),
          sortable: true,
        }),
        expect.objectContaining({
          name: 'labels',
          filterOperatorInfo: expect.arrayContaining([
            expect.objectContaining({ name: 'hasAny' }),
            expect.objectContaining({ name: 'hasAll' }),
          ]),
        }),
        expect.objectContaining({
          name: 'q',
          filterOperatorInfo: [
            expect.objectContaining({
              name: 'matches',
              value: { type: 'string' },
            }),
          ],
        }),
        expect.objectContaining({
          name: 'followUpAt',
          filterOperatorInfo: expect.arrayContaining([
            expect.objectContaining({ name: 'isNull' }),
            expect.objectContaining({ name: 'lt', value: { type: 'date' } }),
            expect.objectContaining({ name: 'gte', value: { type: 'date' } }),
            expect.objectContaining({
              name: 'between',
              value: {
                type: 'tuple',
                items: [{ type: 'date' }, { type: 'date' }],
              },
            }),
          ]),
        }),
        expect.objectContaining({
          name: 'createdAt',
          filterOperatorInfo: expect.arrayContaining([
            expect.objectContaining({ name: 'gte', value: { type: 'date' } }),
          ]),
        }),
      ])
    )
  })

  test('binds literal text and explicit follow-up timestamps', () => {
    const rendered = renderWhere({
      filters: [
        {
          type: 'condition',
          field: 'company',
          operator: 'contains',
          value: `%_' or 1 = 1 --`,
        },
        {
          type: 'condition',
          field: 'followUpAt',
          operator: 'lt',
          value: referenceTime,
        },
      ],
      pagination: { size: 25 },
    })

    expect(rendered.sql).not.toContain(`or 1 = 1 --`)
    expect(rendered.sql).toContain("escape '\\'")
    expect(rendered.params).toContain(`%\\%\\_' or 1 = 1 --%`)
    expect(rendered.params).toContain(referenceTime)
  })

  test('binds only request-owned values for full-text matching', () => {
    const rendered = renderWhere({
      filters: [
        {
          type: 'condition',
          field: 'q',
          operator: 'matches',
          value: 'Effect engineer',
        },
      ],
      pagination: { size: 25 },
    })

    expect(rendered.params).toEqual(
      Array.from({ length: 7 }, () => '%Effect engineer%')
    )
    expect(rendered.sql.match(/escape '\\'/gu)).toHaveLength(7)
  })

  test('binds timestamp ranges from the published date tuple metadata', () => {
    const from = '2026-07-12T09:00:00.000Z'
    const to = '2026-07-12T17:00:00.000Z'
    const rendered = renderWhere({
      filters: [
        {
          type: 'condition',
          field: 'followUpAt',
          operator: 'between',
          value: [from, to],
        },
      ],
      pagination: { size: 25 },
    })

    expect(rendered.sql).toContain('between ? and ?')
    expect(rendered.params).toContain(from)
    expect(rendered.params).toContain(to)
  })

  test('supports generic ordering over computed fields', () => {
    const resolved = applicationListQuery.resolve({
      orderBy: [
        { field: 'noteCount', direction: 'desc' },
        { field: 'updatedRevision', direction: 'asc' },
      ],
      pagination: { size: 10 },
    })

    expect(resolved.ordering.orderBy).toHaveLength(2)
    expect(resolved.ordering.requiredSelection).toBeDefined()
  })

  test('rebinds root expressions for relational-query aliases', () => {
    const root = alias(applications, 'd0')
    const relational = applicationListQuery
      .resolve({
        filters: [
          {
            type: 'condition',
            field: 'labels',
            operator: 'hasAny',
            value: ['priority'],
          },
        ],
        pagination: { size: 10 },
      })
      .relational()
    const where = relational.where(root)
    if (where === undefined) {
      throw new Error('Expected relation filters to produce a predicate.')
    }

    const rendered = dialect.sqlToQuery(where)
    expect(rendered.sql).toContain(
      '"application_labels"."application_id" = "d0"."id"'
    )
    expect(rendered.sql).not.toContain('"applications"."id"')
  })
})
