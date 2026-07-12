import { sql } from 'drizzle-orm'
import { check, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { commandKindValues } from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'

export const commandReceipts = sqliteTable(
  'command_receipts',
  {
    operationId: text('operation_id').notNull(),
    operationRequestSignature: text('operation_request_signature').notNull(),
    kind: text('kind', { enum: commandKindValues }).notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    eventId: text('event_id'),
    captureId: text('capture_id'),
    noteId: text('note_id'),
    recordedAt: text('recorded_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.operationId] }),
    check(
      'command_receipts_kind_check',
      sql`${table.kind} in (${sqlStringList(commandKindValues)})`
    ),
  ]
)
