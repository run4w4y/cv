import { describe, expect, test } from 'bun:test'

import {
  dateFromFilterValue,
  dateRangeFromFilterValue,
  filterValueFromDate,
  filterValueFromDateRange,
  isDateRangeDescriptor,
} from './date-value'

describe('date filter transport values', () => {
  test('round-trips a UTC ISO timestamp through a Date', () => {
    const value = '2026-07-20T09:30:00.000Z'
    expect(filterValueFromDate(dateFromFilterValue(value))).toBe(value)
    expect(dateFromFilterValue('not-a-date')).toBeUndefined()
  })

  test('round-trips date range tuples without changing the API shape', () => {
    const value = [
      '2026-07-20T09:30:00.000Z',
      '2026-07-22T17:00:00.000Z',
    ] as const

    expect(filterValueFromDateRange(dateRangeFromFilterValue(value))).toEqual(
      value
    )
  })

  test('recognizes only two-date tuple descriptors as date ranges', () => {
    expect(
      isDateRangeDescriptor({
        type: 'tuple',
        items: [{ type: 'date' }, { type: 'date' }],
      })
    ).toBe(true)
    expect(
      isDateRangeDescriptor({
        type: 'tuple',
        items: [{ type: 'date' }, { type: 'string' }],
      })
    ).toBe(false)
  })
})
