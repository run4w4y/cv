import { sql } from 'drizzle-orm'
import { check, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { idempotencyScopeValues } from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'

export const idempotencyReceipts = sqliteTable(
  'idempotency_receipts',
  {
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash').notNull(),
    scope: text('scope', { enum: idempotencyScopeValues }).notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    resourceId: text('resource_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.idempotencyKey] }),
    check(
      'idempotency_receipts_scope_check',
      sql`${table.scope} in (${sqlStringList(idempotencyScopeValues)})`
    ),
  ]
)
