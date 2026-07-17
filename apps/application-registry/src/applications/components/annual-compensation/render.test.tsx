import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { AnnualCompensation, formatCompensationAmount } from './render'

describe('AnnualCompensation', () => {
  test('renders original minor-unit boundaries as explicit from and to values', () => {
    const markup = renderToStaticMarkup(
      <AnnualCompensation
        value={{
          currencyCode: 'USD',
          minimumMinor: 150_000_00,
          maximumMinor: 180_000_00,
        }}
      />
    )

    expect(markup).toContain('From')
    expect(markup).toContain('To')
    expect(markup).toContain('USD')
  })

  test('does not invent a missing bound', () => {
    expect(formatCompensationAmount(null, 'USD')).toBe('—')
  })

  test('formats zero- and three-decimal currencies from their minor units', () => {
    expect(formatCompensationAmount(1234, 'JPY')).toContain('1,234')
    expect(formatCompensationAmount(1234, 'KWD')).toContain('1.234')
  })

  test('renders an explicit empty state when compensation is not provided', () => {
    expect(renderToStaticMarkup(<AnnualCompensation value={null} />)).toContain(
      'Not provided'
    )
  })
})
