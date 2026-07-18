import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { jobSnapshotStatusValues } from '../model/content'
import { applications } from './applications'
import { sqlStringList } from './checks'

export const jobPostingSnapshots = sqliteTable(
  'job_posting_snapshots',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    requestedUrl: text('requested_url').notNull(),
    finalUrl: text('final_url'),
    status: text('status', { enum: jobSnapshotStatusValues }).notNull(),
    fetchedAt: text('fetched_at').notNull(),
    fetcherVersion: text('fetcher_version').notNull(),
    rawObjectKey: text('raw_object_key'),
    rawSha256: text('raw_sha256'),
    rawByteLength: integer('raw_byte_length'),
    rawMediaType: text('raw_media_type'),
    normalizedObjectKey: text('normalized_object_key'),
    normalizedSha256: text('normalized_sha256'),
    normalizedByteLength: integer('normalized_byte_length'),
    normalizedMediaType: text('normalized_media_type'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('job_posting_snapshots_application_fetched_idx').on(
      table.applicationId,
      table.fetchedAt,
      table.id
    ),
    check(
      'job_posting_snapshots_status_check',
      sql`${table.status} in (${sqlStringList(jobSnapshotStatusValues)})`
    ),
    check(
      'job_posting_snapshots_raw_byte_length_check',
      sql`${table.rawByteLength} is null or ${table.rawByteLength} >= 0`
    ),
    check(
      'job_posting_snapshots_normalized_byte_length_check',
      sql`${table.normalizedByteLength} is null or ${table.normalizedByteLength} >= 0`
    ),
  ]
)
