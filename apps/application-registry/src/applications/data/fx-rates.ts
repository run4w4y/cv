import {
  CurrencyCodeSchema,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { BrowserKeyValueStore } from '@effect/platform-browser'
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
import {
  Persistable,
  PersistedCache,
  Persistence,
} from 'effect/unstable/persistence'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { hostHttpClientLayer } from '../../lib/registry-client'
import type {
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

const CompensationFxRateSchema = Schema.Struct({
  observedAt: UtcIsoTimestampSchema,
  provider: Schema.Literal('frankfurter'),
  rate: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  sourceCurrency: CurrencyCodeSchema,
  targetCurrency: CurrencyCodeSchema,
})

const CompensationFxRateTableSchema = Schema.Struct({
  rates: Schema.ReadonlyMap(CurrencyCodeSchema, CompensationFxRateSchema),
  targetCurrency: CurrencyCodeSchema,
})

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

class CompensationFxRateTableRequest extends Persistable.Class<{
  payload: { readonly targetCurrency: string }
}>()('CompensationFxRateTableRequest', {
  primaryKey: ({ targetCurrency }) => targetCurrency,
  success: CompensationFxRateTableSchema,
  error: CompensationFxRateError,
}) {}

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
  readonly getRate: (
    sourceCurrency: string,
    targetCurrency: string
  ) => Effect.Effect<CompensationFxRate, CompensationFxRateError>
}

class CompensationFxRates extends Context.Service<
  CompensationFxRates,
  CompensationFxRatesShape
>()('@cv/application-registry-management/CompensationFxRates') {}

const compensationFxPersistenceLayer = Persistence.layerKvs.pipe(
  Layer.provide(BrowserKeyValueStore.layerLocalStorage)
)

const CompensationFxRatesLive = Layer.effect(
  CompensationFxRates,
  Effect.gen(function* () {
    const memoryCache = yield* Cache.makeWith(fetchCompensationFxRateTable, {
      capacity: 16,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? '24 hours' : Duration.zero),
    })
    const persistedCache = yield* PersistedCache.make(
      (request: CompensationFxRateTableRequest) =>
        fetchCompensationFxRateTable(request.targetCurrency),
      {
        storeId: '@cv/application-registry/compensation-fx-rates/v1',
        timeToLive: (exit) =>
          Exit.isSuccess(exit) ? '24 hours' : Duration.zero,
        inMemoryCapacity: 16,
        inMemoryTTL: (exit) =>
          Exit.isSuccess(exit) ? '24 hours' : Duration.zero,
      }
    )

    return CompensationFxRates.of({
      getRate: Effect.fn('CompensationFxRates.getRate')(function* (
        sourceCurrency: string,
        targetCurrency: string
      ) {
        const request = new CompensationFxRateTableRequest({ targetCurrency })
        const getFromMemory = () => Cache.get(memoryCache, targetCurrency)
        const table = yield* persistedCache.get(request).pipe(
          Effect.catchTags({
            PersistenceError: getFromMemory,
            SchemaError: () =>
              persistedCache.invalidate(request).pipe(
                Effect.ignore,
                Effect.andThen(persistedCache.get(request)),
                Effect.catchTags({
                  PersistenceError: getFromMemory,
                  SchemaError: getFromMemory,
                })
              ),
          })
        )
        const rate = table.rates.get(sourceCurrency)
        if (rate === undefined) {
          return yield* new CompensationFxRateError({
            cause: { sourceCurrency, targetCurrency },
            message: `No ${sourceCurrency} to ${targetCurrency} compensation exchange rate is available.`,
          })
        }
        return rate
      }),
    })
  })
).pipe(
  Layer.provide(compensationFxPersistenceLayer),
  Layer.provide(hostHttpClientLayer)
)

const compensationFxRuntime = Atom.runtime(CompensationFxRatesLive)

export const compensationFxRateAtom = Atom.family(
  ({
    sourceCurrency,
    targetCurrency,
  }: {
    readonly sourceCurrency: string
    readonly targetCurrency: string
  }) =>
    compensationFxRuntime
      .atom(
        CompensationFxRates.use((rates) =>
          rates.getRate(sourceCurrency, targetCurrency)
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
