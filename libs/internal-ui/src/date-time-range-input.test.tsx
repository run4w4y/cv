import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup } from '@testing-library/react'

import {
  getDateField,
  getSegmentTypes,
  renderWithLocale,
} from './calendar.test-utils'
import { DateTimeRangeInput } from './date-time-range-input'

afterEach(cleanup)

describe('DateTimeRangeInput', () => {
  test('renders minute-level segments for both endpoints', () => {
    renderWithLocale(<DateTimeRangeInput />)

    expect(getSegmentTypes(getDateField('Start date and time'))).toContain(
      'minute'
    )
    expect(getSegmentTypes(getDateField('End date and time'))).toContain(
      'minute'
    )
  })
})
