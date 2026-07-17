import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup } from '@testing-library/react'

import {
  getDateField,
  getSegmentTypes,
  renderWithLocale,
} from './calendar.test-utils'
import { SegmentedDateInput } from './segmented-date-input'

afterEach(cleanup)

describe('SegmentedDateInput', () => {
  test('uses locale-specific segment ordering', () => {
    renderWithLocale(<SegmentedDateInput ariaLabel="Date" />, 'ru-RU')

    expect(getSegmentTypes(getDateField('Date'))).toEqual([
      'day',
      'month',
      'year',
    ])
  })

  test('adds time segments for minute granularity', () => {
    renderWithLocale(
      <SegmentedDateInput ariaLabel="Date and time" granularity="minute" />
    )

    expect(getSegmentTypes(getDateField('Date and time'))).toEqual([
      'month',
      'day',
      'year',
      'hour',
      'minute',
      'dayPeriod',
    ])
  })
})
