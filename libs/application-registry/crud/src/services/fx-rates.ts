import type { CurrencyCode, FxRate } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'

export interface FxRatesCrud {
  readonly findLatest: (
    baseCurrency: CurrencyCode,
    quoteCurrency: CurrencyCode
  ) => Effect.Effect<FxRate | undefined, RegistryDatabaseError>
  readonly save: (rate: FxRate) => Effect.Effect<void, RegistryDatabaseError>
}

export const FxRatesCrud = Context.Service<FxRatesCrud>(
  '@cv/application-registry-crud/FxRatesCrud'
)
