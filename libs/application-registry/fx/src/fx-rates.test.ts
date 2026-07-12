import { describe, expect, test } from 'bun:test'
import { FxRatesCrud } from '@cv/application-registry-crud'
import type { FxRate } from '@cv/application-registry-entity'
import { Effect, Layer } from 'effect'
import { FxRates, FxRatesLive } from './fx-rates'
import { FxRateProvider } from './provider'

const rate = (fetchedAt: string): FxRate => ({
  baseCurrency: 'USD',
  fetchedAt,
  observedAt: '2026-07-12T00:00:00.000Z',
  provider: 'test',
  quoteCurrency: 'EUR',
  rate: 0.91,
})

const run = <A>(
  effect: Effect.Effect<A, unknown, FxRates>,
  options: {
    readonly cached?: FxRate
    readonly onFetch?: () => void
    readonly onFind?: () => void
    readonly onSave?: (rate: FxRate) => void
  }
) => {
  const crud = Layer.succeed(FxRatesCrud, {
    findLatest: (baseCurrency, quoteCurrency) => {
      options.onFind?.()
      return Effect.succeed(
        options.cached?.baseCurrency === baseCurrency &&
          options.cached.quoteCurrency === quoteCurrency
          ? options.cached
          : undefined
      )
    },
    save: (stored) => Effect.sync(() => options.onSave?.(stored)),
  })
  const provider = Layer.succeed(FxRateProvider, {
    fetch: (base, quote) => {
      options.onFetch?.()
      return Effect.succeed({
        base,
        observedAt: '2026-07-12T00:00:00.000Z',
        provider: 'test',
        quote,
        rate: 0.91,
      })
    },
  })
  const live = FxRatesLive.pipe(Layer.provide(crud), Layer.provide(provider))

  return Effect.runPromise(effect.pipe(Effect.provide(live)))
}

describe('FxRates', () => {
  test('uses a fresh D1 value and then the isolate cache', async () => {
    let finds = 0
    let fetches = 0

    const values = await run(
      Effect.gen(function* () {
        const fx = yield* FxRates
        return yield* Effect.all([fx.get('USD', 'EUR'), fx.get('USD', 'EUR')])
      }),
      {
        cached: rate(new Date().toISOString()),
        onFetch: () => {
          fetches += 1
        },
        onFind: () => {
          finds += 1
        },
      }
    )

    expect(values.map(({ rate: value }) => value)).toEqual([0.91, 0.91])
    expect(finds).toBe(1)
    expect(fetches).toBe(0)
  })

  test('refreshes an expired D1 value once and persists it', async () => {
    let fetches = 0
    const saved: FxRate[] = []
    const expired = new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString()

    await run(
      Effect.gen(function* () {
        const fx = yield* FxRates
        return yield* Effect.all([fx.get('USD', 'EUR'), fx.get('USD', 'EUR')], {
          concurrency: 'unbounded',
        })
      }),
      {
        cached: rate(expired),
        onFetch: () => {
          fetches += 1
        },
        onSave: (stored) => {
          saved.push(stored)
        },
      }
    )

    expect(fetches).toBe(1)
    expect(saved).toHaveLength(1)
  })

  test('does not access storage for identity conversion', async () => {
    let finds = 0

    const identity = await run(
      FxRates.pipe(Effect.flatMap((fx) => fx.get('JPY', 'JPY'))),
      {
        onFind: () => {
          finds += 1
        },
      }
    )

    expect(identity.rate).toBe(1)
    expect(identity.provider).toBe('identity')
    expect(finds).toBe(0)
  })
})
