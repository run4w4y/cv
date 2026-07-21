import { CurrencyCodeSchema } from '@cv/application-registry-entity'
import {
  Cache,
  Context,
  Duration,
  Effect,
  Exit,
  Layer,
  Match,
  Schema,
} from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/unstable/http'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { hostHttpClientLayer } from '../../lib/registry-client'
import type {
  CompensationDisplayCurrency,
  CompensationFxRate,
  CompensationFxRateTable,
} from '../model/currency'

const FrankfurterRateSchema = Schema.Struct({
  base: CurrencyCodeSchema,
  date: Schema.String.pipe(
    Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u))
  ),
  quote: CurrencyCodeSchema,
  rate: Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0))),
})

const FrankfurterRatesSchema = Schema.Array(FrankfurterRateSchema)

type FrankfurterRate = Schema.Schema.Type<typeof FrankfurterRateSchema>

export const frankfurterRatesUrl = (targetCurrency: string) =>
  `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(targetCurrency)}`

export class CompensationFxRateError extends Schema.TaggedErrorClass<CompensationFxRateError>()(
  'CompensationFxRateError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

export const makeCompensationFxRateTable = Effect.fn(
  'CompensationFxRates.makeTable'
)(function* (targetCurrency: string, quotes: readonly FrankfurterRate[]) {
  const rates = new Map<string, CompensationFxRate>()

  for (const quote of quotes) {
    if (quote.base !== targetCurrency) {
      return yield* new CompensationFxRateError({
        cause: quote,
        message: `Frankfurter returned ${quote.base} rates when ${targetCurrency} was requested.`,
      })
    }
    rates.set(quote.quote, {
      observedAt: `${quote.date}T00:00:00.000Z`,
      provider: 'frankfurter',
      rate: 1 / quote.rate,
      sourceCurrency: quote.quote,
      targetCurrency,
    })
  }

  return { rates, targetCurrency } satisfies CompensationFxRateTable
})

const fetchCompensationFxRateTable = Effect.fn(
  'CompensationFxRates.fetchTable'
)((targetCurrency: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const response = yield* client
      .get(frankfurterRatesUrl(targetCurrency), {
        headers: { Accept: 'application/json' },
      })
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))
    const quotes = yield* HttpClientResponse.schemaBodyJson(
      FrankfurterRatesSchema
    )(response)
    return yield* makeCompensationFxRateTable(targetCurrency, quotes)
  }).pipe(
    Effect.mapError((cause) =>
      Match.value(cause).pipe(
        Match.when(Schema.is(CompensationFxRateError), (error) => error),
        Match.orElse(
          (cause) =>
            new CompensationFxRateError({
              cause,
              message: `Could not load ${targetCurrency} compensation exchange rates.`,
            })
        )
      )
    )
  )
)

interface CompensationFxRatesShape {
  readonly get: (
    targetCurrency: string
  ) => Effect.Effect<CompensationFxRateTable, CompensationFxRateError>
}

class CompensationFxRates extends Context.Service<
  CompensationFxRates,
  CompensationFxRatesShape
>()('@cv/application-registry-management/CompensationFxRates') {}

const CompensationFxRatesLive = Layer.effect(
  CompensationFxRates,
  Effect.gen(function* () {
    const cache = yield* Cache.makeWith(fetchCompensationFxRateTable, {
      capacity: 16,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? '24 hours' : Duration.zero),
    })

    return CompensationFxRates.of({
      get: Effect.fn('CompensationFxRates.get')((targetCurrency: string) =>
        Cache.get(cache, targetCurrency)
      ),
    })
  })
).pipe(Layer.provide(hostHttpClientLayer))

const compensationFxRuntime = Atom.runtime(CompensationFxRatesLive)
const originalCurrencyRateTableAtom = Atom.make(
  Effect.succeed<CompensationFxRateTable | null>(null)
)

export const compensationFxRateTableAtom = Atom.family(
  (displayCurrency: CompensationDisplayCurrency) =>
    displayCurrency === 'original'
      ? originalCurrencyRateTableAtom
      : compensationFxRuntime
          .atom(
            CompensationFxRates.use((rates) =>
              rates
                .get(displayCurrency)
                .pipe(
                  Effect.map((table): CompensationFxRateTable | null => table)
                )
            )
          )
          .pipe(
            Atom.swr({
              staleTime: '15 minutes',
              revalidateOnMount: true,
              revalidateOnFocus: false,
            }),
            Atom.setIdleTTL('24 hours')
          )
)
