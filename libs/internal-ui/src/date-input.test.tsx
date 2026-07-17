import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

import { getDateField, renderWithLocale } from './calendar.test-utils'
import { DateInput } from './date-input'

afterEach(cleanup)

describe('DateInput', () => {
  test('renders a locale-aware segmented value', () => {
    renderWithLocale(<DateInput value={new Date(2026, 6, 16)} />)
    expect(getDateField('Select date').textContent).toContain('7/16/2026')
  })

  test('opens the calendar when a segment receives focus', async () => {
    renderWithLocale(<DateInput />)
    const month = within(getDateField('Select date')).getByRole('spinbutton', {
      name: /^month,/i,
    })
    fireEvent.focusIn(month)

    expect(await screen.findByRole('grid')).toBeTruthy()
  })
})
