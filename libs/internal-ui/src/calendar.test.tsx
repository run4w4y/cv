import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, screen } from '@testing-library/react'

import { Calendar } from './calendar'
import { renderWithLocale } from './calendar.test-utils'

afterEach(cleanup)

describe('Calendar', () => {
  test('renders an accessible single-date calendar', () => {
    renderWithLocale(
      <Calendar selected={new Date(2026, 6, 16)} ariaLabel="Due date" />
    )

    expect(screen.getByRole('application', { name: /^Due date/ })).toBeTruthy()
    expect(screen.getByRole('grid')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy()
  })

  test('renders both visible months in range mode', () => {
    renderWithLocale(
      <Calendar
        mode="range"
        selected={{
          from: new Date(2026, 6, 13),
          to: new Date(2026, 6, 24),
        }}
      />
    )

    expect(screen.getAllByRole('grid')).toHaveLength(2)
  })
})
