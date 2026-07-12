import type {
  CurrencyCode,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'
import { Context, Data, type Effect } from 'effect'

export class FxRateProviderError extends Data.TaggedError(
  'FxRateProviderError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export type FxRateQuote = {
  readonly base: CurrencyCode
  readonly observedAt: UtcIsoTimestamp
  readonly provider: string
  readonly quote: CurrencyCode
  readonly rate: number
}

export type FxRateProviderShape = {
  readonly fetch: (
    baseCurrency: CurrencyCode,
    quoteCurrency: CurrencyCode
  ) => Effect.Effect<FxRateQuote, FxRateProviderError>
}

export class FxRateProvider extends Context.Service<
  FxRateProvider,
  FxRateProviderShape
>()('@cv/application-registry-fx/FxRateProvider') {}
