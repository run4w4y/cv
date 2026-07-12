import type { D1Database } from '@cloudflare/workers-types'
import { Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import { findLatestFxRate, saveFxRate } from '../persistence/compensations'
import { FxRatesCrud } from '../services/fx-rates'

export const makeFxRatesCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(FxRatesCrud, {
    findLatest: (baseCurrency, quoteCurrency) =>
      withRegistryConnections(database, ({ query }) =>
        findLatestFxRate(query, baseCurrency, quoteCurrency)
      ),
    save: (rate) =>
      withRegistryConnections(database, ({ query }) =>
        saveFxRate(query, rate).pipe(Effect.asVoid)
      ),
  })
