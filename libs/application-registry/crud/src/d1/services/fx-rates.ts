import { Effect, Layer } from 'effect'

import { RegistryDatabase } from '../../database'
import { findLatestFxRate, saveFxRate } from '../../persistence/compensations'
import { FxRatesCrud } from '../../services/fx-rates'

const makeFxRatesCrudD1 = Effect.map(RegistryDatabase, (database) =>
  FxRatesCrud.of({
    findLatest: (baseCurrency, quoteCurrency) =>
      database.use(({ query }) =>
        findLatestFxRate(query, baseCurrency, quoteCurrency)
      ),
    save: (rate) =>
      database.use(({ query }) => saveFxRate(query, rate).pipe(Effect.asVoid)),
  })
)

export const FxRatesCrudD1Live = Layer.effect(FxRatesCrud, makeFxRatesCrudD1)
