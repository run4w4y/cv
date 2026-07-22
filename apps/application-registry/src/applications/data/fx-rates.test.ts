import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { frankfurterRatesUrl, makeCompensationFxRateTable } from './fx-rates'

describe('compensation FX rate tables', () => {
  test('loads one complete target-currency table directly from Frankfurter', () => {
    expect(frankfurterRatesUrl('JPY')).toBe(
      'https://api.frankfurter.dev/v2/rates?base=JPY'
    )
  })

  test('inverts provider rates into source-to-target conversion rates', async () => {
    const table = await Effect.runPromise(
      makeCompensationFxRateTable('USD', [
        { base: 'USD', date: '2026-07-20', quote: 'EUR', rate: 0.8 },
      ])
    )

    expect(table.rates.get('EUR')).toEqual({
      observedAt: '2026-07-20T00:00:00.000Z',
      provider: 'frankfurter',
      rate: 1.25,
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
    })
  })

  test('rejects a provider response for another base currency', async () => {
    await expect(
      Effect.runPromise(
        makeCompensationFxRateTable('USD', [
          { base: 'EUR', date: '2026-07-20', quote: 'USD', rate: 1.2 },
        ])
      )
    ).rejects.toMatchObject({ _tag: 'CompensationFxRateError' })
  })
})
