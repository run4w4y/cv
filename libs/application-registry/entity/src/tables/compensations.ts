import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core'

import {
  compensationKindValues,
  compensationPeriodValues,
} from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'
import { utcTimestamp } from './columns'

export const applicationCompensations = pgTable(
  'application_compensations',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: compensationKindValues }).notNull(),
    currencyCode: text('currency_code').notNull(),
    minimumMinor: bigint('minimum_minor', { mode: 'number' }),
    maximumMinor: bigint('maximum_minor', { mode: 'number' }),
    period: text('period', { enum: compensationPeriodValues }).notNull(),
    rawText: text('raw_text'),
    source: text('source').notNull(),
    createdAt: utcTimestamp('created_at').notNull(),
    updatedAt: utcTimestamp('updated_at').notNull(),
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
      sql`${table.currencyCode} ~ '^[A-Z]{3}$'`
    ),
    check(
      'application_compensations_period_check',
      sql`${table.period} in (${sqlStringList(compensationPeriodValues)})`
    ),
    check(
      'application_compensations_minimum_check',
      sql`${table.minimumMinor} is null or (${table.minimumMinor} between 0 and 9007199254740991)`
    ),
    check(
      'application_compensations_maximum_check',
      sql`${table.maximumMinor} is null or (${table.maximumMinor} between 0 and 9007199254740991)`
    ),
    check(
      'application_compensations_range_check',
      sql`${table.minimumMinor} is null or ${table.maximumMinor} is null or ${table.minimumMinor} <= ${table.maximumMinor}`
    ),
  ]
)
