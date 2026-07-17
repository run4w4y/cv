import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { getDateField, renderWithLocale } from './calendar.test-utils'
import { DateRangeInput } from './date-range-input'

afterEach(cleanup)

describe('DateRangeInput', () => {
  test('renders both range endpoints', () => {
    renderWithLocale(
      <DateRangeInput
        value={{ from: new Date(2026, 6, 1), to: new Date(2026, 6, 16) }}
      />
    )

    expect(getDateField('Start date')).toBeTruthy()
    expect(getDateField('End date')).toBeTruthy()
  })

  test('opens the range calendar from either endpoint', async () => {
    renderWithLocale(<DateRangeInput />)
    fireEvent.focusIn(getDateField('Start date'))

    expect(await screen.findAllByRole('grid')).toHaveLength(2)
  })
})
