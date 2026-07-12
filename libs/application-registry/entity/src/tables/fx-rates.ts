import { sql } from 'drizzle-orm'
import {
  check,
  index,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const fxRates = sqliteTable(
  'fx_rates',
  {
    baseCurrency: text('base_currency').notNull(),
    quoteCurrency: text('quote_currency').notNull(),
    rate: real('rate').notNull(),
    provider: text('provider').notNull(),
    observedAt: text('observed_at').notNull(),
    fetchedAt: text('fetched_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.baseCurrency,
        table.quoteCurrency,
        table.provider,
        table.observedAt,
      ],
    }),
    index('fx_rates_pair_fetched_idx').on(
      table.baseCurrency,
      table.quoteCurrency,
      table.fetchedAt
    ),
    check(
      'fx_rates_base_currency_check',
      sql`length(${table.baseCurrency}) = 3 and ${table.baseCurrency} glob '[A-Z][A-Z][A-Z]'`
    ),
    check(
      'fx_rates_quote_currency_check',
      sql`length(${table.quoteCurrency}) = 3 and ${table.quoteCurrency} glob '[A-Z][A-Z][A-Z]'`
    ),
    check('fx_rates_rate_check', sql`${table.rate} > 0`),
  ]
)
