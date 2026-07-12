import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { convertMinorAmount } from './conversion'

describe('minor-unit currency conversion', () => {
  test('accounts for currencies with different minor-unit exponents', async () => {
    expect(
      await Effect.runPromise(convertMinorAmount(1_000, 'JPY', 'USD', 0.01))
    ).toBe(1_000)
    expect(
      await Effect.runPromise(convertMinorAmount(12_345, 'USD', 'JPY', 150))
    ).toBe(18_518)
  })

  test('preserves nullable compensation bounds', async () => {
    expect(
      await Effect.runPromise(convertMinorAmount(null, 'EUR', 'USD', 1.1))
    ).toBeNull()
  })

  test('rejects unsafe amounts and rates', async () => {
    const unsafeAmount = await Effect.runPromiseExit(
      convertMinorAmount(Number.MAX_SAFE_INTEGER + 1, 'USD', 'EUR', 1)
    )
    const invalidRate = await Effect.runPromiseExit(
      convertMinorAmount(100, 'USD', 'EUR', 0)
    )

    expect(unsafeAmount._tag).toBe('Failure')
    expect(invalidRate._tag).toBe('Failure')
  })
})
