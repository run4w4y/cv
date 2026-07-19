import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { applications } from './applications'
import { generatedArtifacts } from './artifacts'
import { contentEntries } from './content'

export const pdfGenerationOutbox = sqliteTable(
  'pdf_generation_outbox',
  {
    artifactId: text('artifact_id')
      .primaryKey()
      .references(() => generatedArtifacts.id, { onDelete: 'cascade' }),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    contentEntryId: text('content_entry_id')
      .notNull()
      .references(() => contentEntries.id, { onDelete: 'cascade' }),
    messageVersion: integer('message_version').notNull(),
    attempts: integer('attempts').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastAttemptAt: text('last_attempt_at'),
    lastError: text('last_error'),
    dispatchedAt: text('dispatched_at'),
  },
  (table) => [
    index('pdf_generation_outbox_pending_idx').on(
      table.dispatchedAt,
      table.createdAt
    ),
    check(
      'pdf_generation_outbox_message_version_check',
      sql`${table.messageVersion} >= 1`
    ),
    check('pdf_generation_outbox_attempts_check', sql`${table.attempts} >= 0`),
  ]
)
