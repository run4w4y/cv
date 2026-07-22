import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import type { JsonValue } from '../model/constraints'
import {
  applicationActivityActorValues,
  applicationActivityKindValues,
  applicationActivitySourceValues,
} from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'
import { utcTimestamp } from './columns'

/** Read-only descriptive history issued by registry backend workflows. */
export const applicationActivities = pgTable(
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
    occurredAt: utcTimestamp('occurred_at').notNull(),
    payload: jsonb('payload').$type<JsonValue>().notNull(),
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
  ]
)
