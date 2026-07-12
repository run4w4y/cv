import {
  ApplicationsCrud,
  CompensationsCrud,
  RegistryDatabaseError,
} from '@cv/application-registry-crud'
import type { CurrencyCode } from '@cv/application-registry-entity'
import { FxRates } from '@cv/application-registry-fx'
import { Effect, Layer } from 'effect'
import { uniq } from 'es-toolkit'

import { convertCompensation } from '../internal/compensation-conversion'
import { findRequiredApplication } from '../internal/shared'
import {
  CompensationsService,
  type CompensationsService as CompensationsServiceShape,
} from '../services/compensations'
import type { ApplicationCompensationsResult } from '../types'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const compensations = yield* CompensationsCrud
  const fxRates = yield* FxRates

  return {
    listByApplication: Effect.fn('CompensationsService.listByApplication')(
      (identifier: string, quoteCurrency?: CurrencyCode) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          const originals = yield* compensations.listByApplication(
            application.id
          )

          if (quoteCurrency === undefined) {
            return {
              items: originals.map((original) => ({
                conversion: null,
                original,
              })),
            } satisfies ApplicationCompensationsResult
          }

          const rateEntries = yield* Effect.forEach(
            uniq(originals.map(({ currencyCode }) => currencyCode)),
            (baseCurrency) =>
              fxRates
                .get(baseCurrency, quoteCurrency)
                .pipe(Effect.map((rate) => [baseCurrency, rate] as const))
          )
          const rates = new Map(rateEntries)
          const items = yield* Effect.forEach(originals, (original) =>
            Effect.gen(function* () {
              const rate = rates.get(original.currencyCode)
              if (!rate) {
                return yield* new RegistryDatabaseError({
                  cause: new Error('Resolved compensation rate disappeared.'),
                  message: 'Could not resolve a compensation exchange rate.',
                })
              }
              return yield* convertCompensation(original, quoteCurrency, rate)
            })
          )

          return { items } satisfies ApplicationCompensationsResult
        })
    ),
  } satisfies CompensationsServiceShape
})

export const CompensationsServiceLive = Layer.effect(CompensationsService, make)
