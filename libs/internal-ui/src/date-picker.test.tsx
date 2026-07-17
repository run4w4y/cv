import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { renderWithLocale } from './calendar.test-utils'
import { DatePicker } from './date-picker'

afterEach(cleanup)

describe('DatePicker', () => {
  test('opens its calendar from the trigger', async () => {
    renderWithLocale(<DatePicker />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose a date' }))

    expect(await screen.findByRole('grid')).toBeTruthy()
  })

  test('formats a controlled value', () => {
    renderWithLocale(
      <DatePicker
        value={new Date(2026, 6, 16)}
        formatDate={(date) => `Day ${date?.getDate()}`}
      />
    )

    expect(screen.getByText('Day 16')).toBeTruthy()
  })
})
