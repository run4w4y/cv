import { describe, expect, test } from 'bun:test'

import {
  currencyFractionDigits,
  currencyInputStep,
  majorAmountToMinor,
  minorAmountToMajor,
} from './currency'

describe('currency minor units', () => {
  test('preserves zero-decimal JPY values', () => {
    expect(currencyFractionDigits('JPY')).toBe(0)
    expect(majorAmountToMinor('1234', 'JPY')).toBe(1234)
    expect(minorAmountToMajor(1234, 'JPY')).toBe(1234)
    expect(currencyInputStep('JPY')).toBe('1')
  })

  test('preserves three-decimal KWD values', () => {
    expect(currencyFractionDigits('KWD')).toBe(3)
    expect(majorAmountToMinor('1.234', 'KWD')).toBe(1234)
    expect(minorAmountToMajor(1234, 'KWD')).toBe(1.234)
    expect(currencyInputStep('KWD')).toBe('0.001')
  })

  test('rejects malformed currencies and amounts', () => {
    expect(() => majorAmountToMinor('12', 'US')).toThrow(
      'three-letter currency code'
    )
    expect(() => majorAmountToMinor('-1', 'USD')).toThrow(
      'non-negative numbers'
    )
  })
})
