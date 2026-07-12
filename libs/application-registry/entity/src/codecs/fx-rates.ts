import {
  createInsertSchema,
  createSelectSchema,
} from 'drizzle-orm/effect-schema'
import type { Schema } from 'effect'

import {
  CurrencyCodeSchema,
  PositiveRateSchema,
  UtcIsoTimestampSchema,
} from '../model/constraints'
import { fxRates } from '../tables/fx-rates'
import { refineWith } from './refinements'

const fxRateSelectRefinements = {
  baseCurrency: refineWith(CurrencyCodeSchema),
  quoteCurrency: refineWith(CurrencyCodeSchema),
  rate: refineWith(PositiveRateSchema),
  observedAt: refineWith(UtcIsoTimestampSchema),
  fetchedAt: refineWith(UtcIsoTimestampSchema),
}

const fxRateInsertRefinements = {
  baseCurrency: CurrencyCodeSchema,
  quoteCurrency: CurrencyCodeSchema,
  rate: PositiveRateSchema,
  observedAt: UtcIsoTimestampSchema,
  fetchedAt: UtcIsoTimestampSchema,
}

export const FxRateSchema = createSelectSchema(fxRates, fxRateSelectRefinements)

export const FxRateInsertSchema = createInsertSchema(
  fxRates,
  fxRateInsertRefinements
)

export type FxRate = Schema.Schema.Type<typeof FxRateSchema>
export type NewFxRateRow = typeof fxRates.$inferInsert

export const FxRateInputSchema = FxRateInsertSchema
export type FxRateInput = Schema.Schema.Type<typeof FxRateInputSchema>
