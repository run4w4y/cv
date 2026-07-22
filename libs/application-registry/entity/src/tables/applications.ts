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
  applicationStatusValues,
  listingAvailabilityValues,
  listingCheckConfidenceValues,
  listingCheckReasonValues,
  personalPriorityValues,
  targetStageValues,
} from '../model/values'
import { sqlStringList } from './checks'
import { utcTimestamp } from './columns'

export const applications = pgTable(
  'applications',
  {
    id: text('id').notNull(),
    postingUrl: text('posting_url').notNull(),
    postingUrlNormalized: text('posting_url_normalized').notNull(),
    postingFingerprint: text('posting_fingerprint').notNull(),
    company: text('company').notNull(),
    role: text('role').notNull(),
    location: text('location'),
    applicationStatus: text('application_status', {
      enum: applicationStatusValues,
    })
      .notNull()
      .default('not_started'),
    targetStage: text('target_stage', { enum: targetStageValues })
      .notNull()
      .default('backlog'),
    personalPriority: text('personal_priority', {
      enum: personalPriorityValues,
    }),
    followUpAt: utcTimestamp('follow_up_at'),
    appliedAt: utcTimestamp('applied_at'),
    listingAvailability: text('listing_availability', {
      enum: listingAvailabilityValues,
    })
      .notNull()
      .default('unchecked'),
    listingConfidence: text('listing_confidence', {
      enum: listingCheckConfidenceValues,
    }),
    listingReasonCode: text('listing_reason_code', {
      enum: listingCheckReasonValues,
    }),
    listingCheckedAt: utcTimestamp('listing_checked_at'),
    listingClosedCandidateAt: utcTimestamp('listing_closed_candidate_at'),
    listingConsecutiveClosedChecks: integer('listing_consecutive_closed_checks')
      .notNull()
      .default(0),
    version: integer('version').notNull().default(1),
    updatedRevision: integer('updated_revision').notNull(),
    createdAt: utcTimestamp('created_at').notNull(),
    updatedAt: utcTimestamp('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('applications_posting_fingerprint_unique').on(
      table.postingFingerprint
    ),
    index('applications_posting_url_normalized_idx').on(
      table.postingUrlNormalized
    ),
    index('applications_company_idx').on(table.company),
    index('applications_status_updated_revision_idx').on(
      table.applicationStatus,
      table.updatedRevision
    ),
    index('applications_target_stage_updated_revision_idx').on(
      table.targetStage,
      table.updatedRevision
    ),
    index('applications_listing_availability_idx').on(
      table.listingAvailability
    ),
    uniqueIndex('applications_updated_revision_unique').on(
      table.updatedRevision
    ),
    check(
      'applications_status_check',
      sql`${table.applicationStatus} in (${sqlStringList(applicationStatusValues)})`
    ),
    check(
      'applications_target_stage_check',
      sql`${table.targetStage} in (${sqlStringList(targetStageValues)})`
    ),
    check(
      'applications_personal_priority_check',
      sql`${table.personalPriority} is null or ${table.personalPriority} in (${sqlStringList(personalPriorityValues)})`
    ),
    check(
      'applications_listing_availability_check',
      sql`${table.listingAvailability} in (${sqlStringList(listingAvailabilityValues)})`
    ),
    check(
      'applications_listing_confidence_check',
      sql`${table.listingConfidence} is null or ${table.listingConfidence} in (${sqlStringList(listingCheckConfidenceValues)})`
    ),
    check(
      'applications_listing_reason_check',
      sql`${table.listingReasonCode} is null or ${table.listingReasonCode} in (${sqlStringList(listingCheckReasonValues)})`
    ),
    check(
      'applications_listing_closed_count_check',
      sql`${table.listingConsecutiveClosedChecks} >= 0`
    ),
    check('applications_version_check', sql`${table.version} >= 1`),
  ]
)
