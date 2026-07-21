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

import type { ListingCheckEvidence } from '../model/listing-checks'
import {
  listingCheckActionValues,
  listingCheckConfidenceValues,
  listingCheckModeValues,
  listingCheckOutcomeValues,
  listingCheckReasonValues,
  listingCheckRunStateValues,
  listingCheckRunTriggerValues,
} from '../model/values'
import { applications } from './applications'
import { sqlStringList } from './checks'
import { utcTimestamp } from './columns'

export const listingCheckRuns = pgTable(
  'listing_check_runs',
  {
    id: text('id').notNull(),
    trigger: text('trigger', { enum: listingCheckRunTriggerValues }).notNull(),
    mode: text('mode', { enum: listingCheckModeValues }).notNull(),
    state: text('state', { enum: listingCheckRunStateValues }).notNull(),
    selectedCount: integer('selected_count').notNull().default(0),
    checkedCount: integer('checked_count').notNull().default(0),
    openCount: integer('open_count').notNull().default(0),
    closedCount: integer('closed_count').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    startedAt: utcTimestamp('started_at').notNull(),
    completedAt: utcTimestamp('completed_at'),
    failedAt: utcTimestamp('failed_at'),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('listing_check_runs_started_idx').on(table.startedAt, table.id),
    check(
      'listing_check_runs_trigger_check',
      sql`${table.trigger} in (${sqlStringList(listingCheckRunTriggerValues)})`
    ),
    check(
      'listing_check_runs_mode_check',
      sql`${table.mode} in (${sqlStringList(listingCheckModeValues)})`
    ),
    check(
      'listing_check_runs_state_check',
      sql`${table.state} in (${sqlStringList(listingCheckRunStateValues)})`
    ),
    check(
      'listing_check_runs_counts_check',
      sql`${table.selectedCount} >= 0 and ${table.checkedCount} >= 0 and ${table.openCount} >= 0 and ${table.closedCount} >= 0 and ${table.reviewCount} >= 0 and ${table.errorCount} >= 0`
    ),
    check(
      'listing_check_runs_terminal_state_check',
      sql`(${table.state} = 'running' and ${table.completedAt} is null and ${table.failedAt} is null and ${table.failureCode} is null and ${table.failureMessage} is null) or (${table.state} = 'completed' and ${table.completedAt} is not null and ${table.failedAt} is null and ${table.failureCode} is null and ${table.failureMessage} is null) or (${table.state} = 'failed' and ${table.completedAt} is null and ${table.failedAt} is not null and ${table.failureCode} is not null and ${table.failureMessage} is not null)`
    ),
  ]
)

export const applicationListingCheckSchedules = pgTable(
  'application_listing_check_schedules',
  {
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    dueAt: utcTimestamp('due_at').notNull(),
    leaseToken: text('lease_token'),
    leaseUntil: utcTimestamp('lease_until'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    updatedAt: utcTimestamp('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.applicationId] }),
    index('listing_check_schedules_due_lease_idx').on(
      table.dueAt,
      table.leaseUntil
    ),
    check(
      'listing_check_schedules_attempt_count_check',
      sql`${table.attemptCount} >= 0`
    ),
  ]
)

export const applicationListingChecks = pgTable(
  'application_listing_checks',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    runId: text('run_id').references(() => listingCheckRuns.id, {
      onDelete: 'set null',
    }),
    operationId: text('operation_id').notNull(),
    requestedUrl: text('requested_url').notNull(),
    finalUrl: text('final_url'),
    provider: text('provider').notNull(),
    outcome: text('outcome', { enum: listingCheckOutcomeValues }).notNull(),
    confidence: text('confidence', {
      enum: listingCheckConfidenceValues,
    }).notNull(),
    recommendedAction: text('recommended_action', {
      enum: listingCheckActionValues,
    }).notNull(),
    reasonCode: text('reason_code', {
      enum: listingCheckReasonValues,
    }).notNull(),
    httpStatus: integer('http_status'),
    evidence: jsonb('evidence')
      .$type<readonly ListingCheckEvidence[]>()
      .notNull(),
    contentHash: text('content_hash'),
    checkerVersion: text('checker_version').notNull(),
    checkedAt: utcTimestamp('checked_at').notNull(),
    receivedAt: utcTimestamp('received_at').notNull(),
    nextCheckAt: utcTimestamp('next_check_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('application_listing_checks_operation_unique').on(
      table.operationId
    ),
    index('application_listing_checks_application_checked_idx').on(
      table.applicationId,
      table.checkedAt,
      table.id
    ),
    index('application_listing_checks_run_idx').on(table.runId, table.id),
    check(
      'application_listing_checks_outcome_check',
      sql`${table.outcome} in (${sqlStringList(listingCheckOutcomeValues)})`
    ),
    check(
      'application_listing_checks_confidence_check',
      sql`${table.confidence} in (${sqlStringList(listingCheckConfidenceValues)})`
    ),
    check(
      'application_listing_checks_action_check',
      sql`${table.recommendedAction} in (${sqlStringList(listingCheckActionValues)})`
    ),
    check(
      'application_listing_checks_reason_check',
      sql`${table.reasonCode} in (${sqlStringList(listingCheckReasonValues)})`
    ),
    check(
      'application_listing_checks_http_status_check',
      sql`${table.httpStatus} is null or (${table.httpStatus} >= 100 and ${table.httpStatus} <= 599)`
    ),
  ]
)
