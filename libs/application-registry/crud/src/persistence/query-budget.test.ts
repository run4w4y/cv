import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { d1MaxBoundParameters, enforceD1ParameterBudget } from './query-budget'

const queryWithParameters = (count: number) => ({
  toSQL: () => ({ params: Array.from({ length: count }) }),
})

describe('D1 query parameter budget', () => {
  test('accepts statements at the D1 boundary', () => {
    expect(
      Effect.runSync(
        enforceD1ParameterBudget(
          queryWithParameters(d1MaxBoundParameters),
          'Test query'
        )
      )
    ).toBeUndefined()
  })

  test('rejects statements beyond the D1 boundary with a typed error', () => {
    const error = Effect.runSync(
      Effect.flip(
        enforceD1ParameterBudget(
          queryWithParameters(d1MaxBoundParameters + 1),
          'Test query'
        )
      )
    )

    expect(error._tag).toBe('RegistryQueryTooComplexError')
    expect(error.parameterCount).toBe(101)
    expect(error.maxParameters).toBe(100)
  })
})
