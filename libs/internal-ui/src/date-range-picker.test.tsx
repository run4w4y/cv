import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { renderWithLocale } from './calendar.test-utils'
import { DateRangePicker } from './date-range-picker'

afterEach(cleanup)

describe('DateRangePicker', () => {
  test('opens a two-month range calendar', async () => {
    renderWithLocale(<DateRangePicker />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose a date range' }))

    expect(await screen.findAllByRole('grid')).toHaveLength(2)
  })

  test('supports custom range formatting', () => {
    renderWithLocale(
      <DateRangePicker
        value={{ from: new Date(2026, 6, 1), to: new Date(2026, 6, 16) }}
        formatRange={(range) =>
          `${range?.from?.getDate()}–${range?.to?.getDate()}`
        }
      />
    )

    expect(screen.getByText('1–16')).toBeTruthy()
  })
})
