import { afterEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import * as React from 'react'

import {
  getDateField,
  getSegmentTypes,
  renderWithLocale,
} from './calendar.test-utils'
import { DateTimeInput } from './date-time-input'

afterEach(cleanup)

describe('DateTimeInput', () => {
  test('renders date and time segments', () => {
    renderWithLocale(<DateTimeInput value={new Date(2026, 6, 16, 14, 30)} />)

    expect(getSegmentTypes(getDateField('Select date and time'))).toContain(
      'minute'
    )
    expect(screen.getByLabelText('Open calendar')).toBeTruthy()
  })

  test('keeps the calendar open when its explicit trigger is pressed', async () => {
    renderWithLocale(<DateTimeInput />)

    fireEvent.click(screen.getByLabelText('Open calendar'))

    expect(await screen.findByRole('grid')).toBeTruthy()
  })

  test('uses a visible external label and delegates programmatic focus to a segment', () => {
    const ref = React.createRef<HTMLDivElement>()
    renderWithLocale(
      <>
        <span id="scheduled-at-label">Scheduled at</span>
        <DateTimeInput
          ref={ref}
          aria-labelledby="scheduled-at-label"
          value={new Date(2026, 6, 16, 14, 30)}
        />
      </>
    )

    const field = screen.getByRole('group', { name: 'Scheduled at' })
    expect(field.getAttribute('aria-labelledby')).toBe('scheduled-at-label')

    act(() => ref.current?.focus())
    expect(document.activeElement?.getAttribute('role')).toBe('spinbutton')
  })

  test('submits its value through an external form owner', () => {
    const view = renderWithLocale(
      <>
        <form id="row-editor" />
        <DateTimeInput
          name="scheduledAt"
          form="row-editor"
          value={new Date(2026, 6, 16, 14, 30)}
        />
      </>
    )
    const form = view.container.querySelector<HTMLFormElement>('#row-editor')
    const input = view.container.querySelector<HTMLInputElement>(
      'input[name="scheduledAt"]'
    )

    expect(input?.form).toBe(form)
    expect(form && new FormData(form).get('scheduledAt')).toBe(
      '2026-07-16T14:30:00'
    )
  })
})
