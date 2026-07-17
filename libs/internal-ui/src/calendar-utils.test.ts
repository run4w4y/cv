import { describe, expect, test } from 'bun:test'
import { CalendarDate } from '@internationalized/date'

import {
  capitalizeMonthLabel,
  formatMonthRangeLabel,
  fromRangeValue,
  isWithinBounds,
  toRangeValue,
} from './calendar-utils'

describe('calendar utilities', () => {
  test('round-trips complete JavaScript date ranges', () => {
    const range = {
      from: new Date(2026, 6, 1),
      to: new Date(2026, 6, 16),
    }

    const result = fromRangeValue(toRangeValue(range))
    expect(result?.from?.getDate()).toBe(1)
    expect(result?.to?.getDate()).toBe(16)
  })

  test('formats and capitalizes localized month ranges', () => {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
    })

    expect(capitalizeMonthLabel('май – июнь', 'ru-RU')).toBe('Май – Июнь')
    expect(
      formatMonthRangeLabel(
        new CalendarDate(2026, 5, 1),
        2,
        formatter,
        'UTC',
        'ru-RU'
      )
    ).toBe('Май 2026 г. – Июнь 2026 г.')
  })

  test('compares calendar bounds without time-of-day leakage', () => {
    expect(
      isWithinBounds(
        new Date(2026, 6, 16, 23, 59),
        new Date(2026, 6, 16, 8, 0),
        new Date(2026, 6, 16, 9, 0)
      )
    ).toBe(true)
  })
})
