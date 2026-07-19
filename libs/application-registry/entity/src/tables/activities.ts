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
import {
  applicationActivityActorValues,
  applicationActivityKindValues,
  applicationActivitySourceValues,
} from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'

/** Read-only descriptive history issued by registry backend workflows. */
export const applicationActivities = sqliteTable(
  'application_activities',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: applicationActivityKindValues }).notNull(),
    actor: text('actor', { enum: applicationActivityActorValues }).notNull(),
    source: text('source', { enum: applicationActivitySourceValues }).notNull(),
    revision: integer('revision').notNull(),
    occurredAt: text('occurred_at').notNull(),
    payload: text('payload', { mode: 'json' }).$type<JsonValue>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('application_activities_application_occurred_idx').on(
      table.applicationId,
      table.occurredAt,
      table.id
    ),
    index('application_activities_application_revision_idx').on(
      table.applicationId,
      table.revision
    ),
    uniqueIndex('application_activities_revision_unique').on(table.revision),
    check(
      'application_activities_kind_check',
      sql`${table.kind} in (${sqlStringList(applicationActivityKindValues)})`
    ),
    check(
      'application_activities_actor_check',
      sql`${table.actor} in (${sqlStringList(applicationActivityActorValues)})`
    ),
    check(
      'application_activities_source_check',
      sql`${table.source} in (${sqlStringList(applicationActivitySourceValues)})`
    ),
    check(
      'application_activities_payload_json_check',
      sql`json_valid(${table.payload})`
    ),
  ]
)
