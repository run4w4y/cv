import { sql } from 'drizzle-orm'
import {
  check,
  index,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import type { ArtifactManifestEntry, SubmissionDetails } from '../model/details'
import { applications } from './applications'

export const campaignCaptures = sqliteTable(
  'campaign_captures',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    campaignRunId: text('campaign_run_id').notNull(),
    profile: text('profile').notNull(),
    audience: text('audience'),
    confidence: real('confidence'),
    submissionDetails: text('submission_details', { mode: 'json' })
      .$type<SubmissionDetails>()
      .notNull(),
    artifacts: text('artifacts', { mode: 'json' })
      .$type<readonly ArtifactManifestEntry[]>()
      .notNull(),
    jobContentHash: text('job_content_hash'),
    capturedAt: text('captured_at').notNull(),
    operationId: text('operation_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('campaign_captures_operation_id_unique').on(table.operationId),
    index('campaign_captures_application_captured_idx').on(
      table.applicationId,
      table.capturedAt,
      table.id
    ),
    check(
      'campaign_captures_confidence_check',
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`
    ),
    check(
      'campaign_captures_submission_details_json_check',
      sql`json_valid(${table.submissionDetails})`
    ),
    check(
      'campaign_captures_artifacts_json_check',
      sql`json_valid(${table.artifacts})`
    ),
  ]
)
