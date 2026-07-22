import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { applications } from './applications'
import { utcTimestamp } from './columns'
import { contentEntries, contentRevisions } from './content'

export const cvLinks = pgTable(
  'cv_links',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    contentEntryId: text('content_entry_id')
      .notNull()
      .references(() => contentEntries.id, { onDelete: 'cascade' }),
    currentRevisionId: text('current_revision_id')
      .notNull()
      .references(() => contentRevisions.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    previewToken: text('preview_token').notNull(),
    publicUrl: text('public_url').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    disabledReason: text('disabled_reason'),
    disabledAt: utcTimestamp('disabled_at'),
    publicationVersion: integer('publication_version').notNull().default(1),
    version: integer('version').notNull().default(1),
    createdAt: utcTimestamp('created_at').notNull(),
    updatedAt: utcTimestamp('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('cv_links_token_unique').on(table.token),
    uniqueIndex('cv_links_preview_token_unique').on(table.previewToken),
    uniqueIndex('cv_links_content_entry_unique').on(table.contentEntryId),
    index('cv_links_application_enabled_idx').on(
      table.applicationId,
      table.enabled
    ),
    check(
      'cv_links_publication_version_check',
      sql`${table.publicationVersion} >= 1`
    ),
    check('cv_links_version_check', sql`${table.version} >= 1`),
  ]
)
