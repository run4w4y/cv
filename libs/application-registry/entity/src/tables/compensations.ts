import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import {
  compensationKindValues,
  compensationPeriodValues,
} from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'

export const applicationCompensations = sqliteTable(
  'application_compensations',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: compensationKindValues }).notNull(),
    currencyCode: text('currency_code').notNull(),
    minimumMinor: integer('minimum_minor'),
    maximumMinor: integer('maximum_minor'),
    period: text('period', { enum: compensationPeriodValues }).notNull(),
    rawText: text('raw_text'),
    source: text('source').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('application_compensations_application_idx').on(
      table.applicationId,
      table.kind,
      table.id
    ),
    check(
      'application_compensations_kind_check',
      sql`${table.kind} in (${sqlStringList(compensationKindValues)})`
    ),
    check(
      'application_compensations_currency_code_check',
      sql`length(${table.currencyCode}) = 3 and ${table.currencyCode} glob '[A-Z][A-Z][A-Z]'`
    ),
    check(
      'application_compensations_period_check',
      sql`${table.period} in (${sqlStringList(compensationPeriodValues)})`
    ),
    check(
      'application_compensations_minimum_check',
      sql`${table.minimumMinor} is null or ${table.minimumMinor} >= 0`
    ),
    check(
      'application_compensations_maximum_check',
      sql`${table.maximumMinor} is null or ${table.maximumMinor} >= 0`
    ),
    check(
      'application_compensations_range_check',
      sql`${table.minimumMinor} is null or ${table.maximumMinor} is null or ${table.minimumMinor} <= ${table.maximumMinor}`
    ),
  ]
)
