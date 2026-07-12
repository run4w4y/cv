import {
  type CurrencyCode,
  CurrencyCodeSchema,
} from '@cv/application-registry-entity'
import { Effect, Layer, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/unstable/http'

import {
  FxRateProvider,
  FxRateProviderError,
  type FxRateQuote,
} from './provider'

const FrankfurterRateSchema = Schema.Struct({
  base: CurrencyCodeSchema,
  date: Schema.String.pipe(
    Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u))
  ),
  quote: CurrencyCodeSchema,
  rate: Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0))),
})

export const fetchFrankfurterRate = (
  baseCurrency: CurrencyCode,
  quoteCurrency: CurrencyCode
) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const response = yield* client
      .get(
        `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(baseCurrency)}/${encodeURIComponent(quoteCurrency)}`,
        { headers: { Accept: 'application/json' } }
      )
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))
    const rate = yield* HttpClientResponse.schemaBodyJson(
      FrankfurterRateSchema
    )(response)

    return {
      base: rate.base,
      observedAt: `${rate.date}T00:00:00.000Z`,
      provider: 'frankfurter',
      quote: rate.quote,
      rate: rate.rate,
    } satisfies FxRateQuote
  }).pipe(
    Effect.mapError(
      (cause) =>
        new FxRateProviderError({
          cause,
          message: `Could not load the ${baseCurrency}/${quoteCurrency} exchange rate.`,
        })
    ),
    Effect.withSpan('ApplicationRegistry.fetchFxRate', {
      attributes: { baseCurrency, quoteCurrency },
    })
  )

export const FrankfurterFxRateProviderLive = Layer.effect(
  FxRateProvider,
  HttpClient.HttpClient.pipe(
    Effect.map((client) => ({
      fetch: (baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode) =>
        fetchFrankfurterRate(baseCurrency, quoteCurrency).pipe(
          Effect.provideService(HttpClient.HttpClient, client)
        ),
    }))
  )
)
