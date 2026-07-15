import { describe, expect, test } from 'bun:test'

import {
  applicationFilters,
  makeApplicationListQuery,
} from './application-list-query'

const referenceTime = '2026-07-15T12:00:00.000Z'

describe('application list query', () => {
  test.each([
    [
      'none',
      {
        type: 'condition',
        field: 'followUpAt',
        operator: 'isNull',
      },
    ],
    [
      'overdue',
      {
        type: 'condition',
        field: 'followUpAt',
        operator: 'lt',
        value: referenceTime,
      },
    ],
    [
      'upcoming',
      {
        type: 'condition',
        field: 'followUpAt',
        operator: 'gte',
        value: referenceTime,
      },
    ],
  ] as const)('translates the %s shortcut to a primitive follow-up filter', (followUpShortcut, expected) => {
    expect(applicationFilters({ followUpShortcut }, referenceTime)).toEqual([
      expected,
    ])
  })

  test('reuses one filter set across every cursor page', () => {
    const query = makeApplicationListQuery(
      {
        currency: 'USD',
        followUpShortcut: 'overdue',
        size: 25,
      },
      { all: true, referenceTime, search: 'platform' }
    )

    const first = query(undefined)
    const continuation = query('next-page')

    expect(continuation.filters).toBe(first.filters)
    expect(first.filters).toEqual([
      {
        type: 'condition',
        field: 'followUpAt',
        operator: 'lt',
        value: referenceTime,
      },
      {
        type: 'condition',
        field: 'q',
        operator: 'matches',
        value: 'platform',
      },
    ])
    expect(first).toMatchObject({
      currency: 'USD',
      pagination: { after: undefined, size: 100 },
    })
    expect(continuation).toMatchObject({
      currency: 'USD',
      pagination: { after: 'next-page', size: 100 },
    })
  })
})
