import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import {
  contentEntryKindValues,
  contentEntryStateValues,
  contentRevisionSourceValues,
} from '../model/content'
import { applications } from './applications'
import { sqlStringList } from './checks'
import { utcTimestamp } from './columns'
import { jobPostingSnapshots } from './job-posting-snapshots'

export const contentEntries = pgTable(
  'content_entries',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: contentEntryKindValues }).notNull(),
    locale: text('locale').notNull(),
    state: text('state', { enum: contentEntryStateValues })
      .notNull()
      .default('draft'),
    headRevisionId: text('head_revision_id'),
    approvedRevisionId: text('approved_revision_id'),
    version: integer('version').notNull().default(1),
    createdAt: utcTimestamp('created_at').notNull(),
    updatedAt: utcTimestamp('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('content_entries_application_kind_locale_unique').on(
      table.applicationId,
      table.kind,
      table.locale
    ),
    index('content_entries_application_updated_idx').on(
      table.applicationId,
      table.updatedAt,
      table.id
    ),
    check(
      'content_entries_kind_check',
      sql`${table.kind} in (${sqlStringList(contentEntryKindValues)})`
    ),
    check(
      'content_entries_state_check',
      sql`${table.state} in (${sqlStringList(contentEntryStateValues)})`
    ),
    check('content_entries_version_check', sql`${table.version} >= 1`),
  ]
)

export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: text('id').notNull(),
    contentEntryId: text('content_entry_id')
      .notNull()
      .references(() => contentEntries.id, { onDelete: 'cascade' }),
    revisionNumber: integer('revision_number').notNull(),
    parentRevisionId: text('parent_revision_id'),
    contractId: text('contract_id').notNull(),
    contractVersion: text('contract_version').notNull(),
    objectKey: text('object_key').notNull(),
    sha256: text('sha256').notNull(),
    byteLength: integer('byte_length').notNull(),
    mediaType: text('media_type').notNull(),
    source: text('source', { enum: contentRevisionSourceValues }).notNull(),
    // Provenance only: facts live in the private immutable object store, not in
    // the application registry database.
    factsReleaseId: text('facts_release_id'),
    jobSnapshotId: text('job_snapshot_id').references(
      () => jobPostingSnapshots.id,
      { onDelete: 'set null' }
    ),
    operationId: text('operation_id').notNull(),
    createdAt: utcTimestamp('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('content_revisions_entry_number_unique').on(
      table.contentEntryId,
      table.revisionNumber
    ),
    uniqueIndex('content_revisions_operation_unique').on(table.operationId),
    index('content_revisions_entry_created_idx').on(
      table.contentEntryId,
      table.createdAt,
      table.id
    ),
    check(
      'content_revisions_source_check',
      sql`${table.source} in (${sqlStringList(contentRevisionSourceValues)})`
    ),
    check(
      'content_revisions_revision_number_check',
      sql`${table.revisionNumber} >= 1`
    ),
    check('content_revisions_byte_length_check', sql`${table.byteLength} >= 0`),
  ]
)
