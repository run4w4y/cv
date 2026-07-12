import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import type { JsonValue } from '../model/constraints'
import { applicationEventKindValues } from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'

export const applicationEvents = sqliteTable(
  'application_events',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: applicationEventKindValues }).notNull(),
    revision: integer('revision').notNull(),
    occurredAt: text('occurred_at').notNull(),
    recordedAt: text('recorded_at').notNull(),
    deviceId: text('device_id'),
    payload: text('payload', { mode: 'json' }).$type<JsonValue>().notNull(),
    operationId: text('operation_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('application_events_operation_id_unique').on(table.operationId),
    index('application_events_application_occurred_idx').on(
      table.applicationId,
      table.occurredAt,
      table.id
    ),
    uniqueIndex('application_events_revision_unique').on(table.revision),
    check(
      'application_events_kind_check',
      sql`${table.kind} in (${sqlStringList(applicationEventKindValues)})`
    ),
    check(
      'application_events_payload_json_check',
      sql`json_valid(${table.payload})`
    ),
  ]
)
