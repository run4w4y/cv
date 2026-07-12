import {
  FxRatesCrud,
  RegistryDatabaseError,
} from '@cv/application-registry-crud'
import type {
  CurrencyCode,
  FxRate,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'
import { Cache, Clock, Context, DateTime, Effect, Exit, Layer } from 'effect'

import { FxRateProvider } from './provider'

const freshnessMillis = 24 * 60 * 60 * 1_000

export interface FxRatesShape {
  readonly get: (
    baseCurrency: CurrencyCode,
    quoteCurrency: CurrencyCode
  ) => Effect.Effect<FxRate, RegistryDatabaseError>
}

type FxPairKey = `${string}/${string}`

const pairKey = (
  baseCurrency: CurrencyCode,
  quoteCurrency: CurrencyCode
): FxPairKey => `${baseCurrency}/${quoteCurrency}`

const splitPair = (key: FxPairKey): readonly [CurrencyCode, CurrencyCode] => {
  const separator = key.indexOf('/')
  return [key.slice(0, separator), key.slice(separator + 1)]
}

const remainingFreshness = (rate: FxRate, now: number) =>
  Math.max(0, Date.parse(rate.fetchedAt) + freshnessMillis - now)

const make = Effect.gen(function* () {
  const crud = yield* FxRatesCrud
  const provider = yield* FxRateProvider

  const lookup = (key: FxPairKey) =>
    Effect.gen(function* () {
      const [baseCurrency, quoteCurrency] = splitPair(key)
      const now = yield* Clock.currentTimeMillis
      const direct = yield* crud.findLatest(baseCurrency, quoteCurrency)
      if (direct && remainingFreshness(direct, now) > 0) {
        return {
          rate: direct,
          timeToLiveMillis: remainingFreshness(direct, now),
        }
      }

      const inverse = yield* crud.findLatest(quoteCurrency, baseCurrency)
      if (inverse && remainingFreshness(inverse, now) > 0) {
        return {
          rate: {
            baseCurrency,
            fetchedAt: inverse.fetchedAt,
            observedAt: inverse.observedAt,
            provider: `${inverse.provider}:inverse`,
            quoteCurrency,
            rate: 1 / inverse.rate,
          },
          timeToLiveMillis: remainingFreshness(inverse, now),
        }
      }

      const quote = yield* provider
        .fetch(baseCurrency, quoteCurrency)
        .pipe(
          Effect.mapError(
            (cause) =>
              new RegistryDatabaseError({ cause, message: cause.message })
          )
        )
      if (quote.base !== baseCurrency || quote.quote !== quoteCurrency) {
        return yield* new RegistryDatabaseError({
          cause: quote,
          message: 'The exchange-rate provider returned another pair.',
        })
      }

      const fetchedAt: UtcIsoTimestamp = DateTime.formatIso(
        DateTime.fromDateUnsafe(new Date(now))
      )
      const rate: FxRate = {
        baseCurrency,
        fetchedAt,
        observedAt: quote.observedAt,
        provider: quote.provider,
        quoteCurrency,
        rate: quote.rate,
      }
      yield* crud.save(rate)
      return { rate, timeToLiveMillis: freshnessMillis }
    })

  const cache = yield* Cache.makeWith(lookup, {
    capacity: 256,
    timeToLive: (exit) =>
      Exit.isSuccess(exit)
        ? `${Math.max(1, exit.value.timeToLiveMillis)} millis`
        : '1 minute',
  })

  return {
    get: (
      baseCurrency: CurrencyCode,
      quoteCurrency: CurrencyCode
    ): Effect.Effect<FxRate, RegistryDatabaseError> =>
      baseCurrency === quoteCurrency
        ? Clock.currentTimeMillis.pipe(
            Effect.map((now) => {
              const fetchedAt: UtcIsoTimestamp = DateTime.formatIso(
                DateTime.fromDateUnsafe(new Date(now))
              )
              return {
                baseCurrency,
                fetchedAt,
                observedAt: fetchedAt,
                provider: 'identity',
                quoteCurrency,
                rate: 1,
              }
            })
          )
        : Cache.get(cache, pairKey(baseCurrency, quoteCurrency)).pipe(
            Effect.map(({ rate }) => rate)
          ),
  } satisfies FxRatesShape
})

export class FxRates extends Context.Service<FxRates, FxRatesShape>()(
  '@cv/application-registry-fx/FxRates'
) {}

export const FxRatesLive = Layer.effect(FxRates, make)
