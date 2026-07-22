import { describe, expect, test } from 'bun:test'

import {
  convertMinorAmount,
  currencyFractionDigits,
  currencyInputStep,
  displayAnnualCompensation,
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

  test('converts minor amounts across currencies with different precision', () => {
    expect(convertMinorAmount(1_000, 'JPY', 'USD', 0.01)).toBe(1_000)
    expect(convertMinorAmount(12_345, 'USD', 'JPY', 150)).toBe(18_518)
    expect(convertMinorAmount(null, 'EUR', 'USD', 1.1)).toBeNull()
  })

  test('derives a converted annual value without changing the original', () => {
    const original = {
      currencyCode: 'EUR',
      maximumMinor: 12_000,
      minimumMinor: 10_000,
    }
    const displayed = displayAnnualCompensation(original, 'USD', {
      targetCurrency: 'USD',
      rates: new Map([
        [
          'EUR',
          {
            observedAt: '2026-07-20T00:00:00.000Z',
            provider: 'frankfurter',
            rate: 1.2,
            sourceCurrency: 'EUR',
            targetCurrency: 'USD',
          },
        ],
      ]),
    })

    expect(displayed).toEqual({
      observedAt: '2026-07-20T00:00:00.000Z',
      status: 'converted',
      value: {
        currencyCode: 'USD',
        maximumMinor: 14_400,
        minimumMinor: 12_000,
      },
    })
    expect(original.currencyCode).toBe('EUR')
  })

  test('keeps originals visible when a requested rate is unavailable', () => {
    const original = {
      currencyCode: 'EUR',
      maximumMinor: 12_000,
      minimumMinor: 10_000,
    }

    expect(displayAnnualCompensation(original, 'USD')).toEqual({
      status: 'unavailable',
      value: original,
    })
  })
})
