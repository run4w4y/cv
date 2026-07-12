import { sql } from 'drizzle-orm'
import {
  check,
  index,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { applicationNoteKindValues } from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'

export const applicationLabels = sqliteTable(
  'application_labels',
  {
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.applicationId, table.label] }),
    index('application_labels_label_idx').on(table.label, table.applicationId),
  ]
)

export const applicationNotes = sqliteTable(
  'application_notes',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: applicationNoteKindValues }).notNull(),
    body: text('body').notNull(),
    source: text('source'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('application_notes_application_created_idx').on(
      table.applicationId,
      table.createdAt,
      table.id
    ),
    check(
      'application_notes_kind_check',
      sql`${table.kind} in (${sqlStringList(applicationNoteKindValues)})`
    ),
  ]
)
