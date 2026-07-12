import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import type { OpportunityDetails } from '../model/details'
import {
  applicationStatusValues,
  personalPriorityValues,
  targetStageValues,
} from '../model/values'
import { sqlStringList } from './checks'

export const applications = sqliteTable(
  'applications',
  {
    id: text('id').notNull(),
    jobKey: text('job_key').notNull(),
    source: text('source').notNull(),
    sourceJobId: text('source_job_id'),
    canonicalUrl: text('canonical_url').notNull(),
    company: text('company').notNull(),
    companyNormalized: text('company_normalized').notNull(),
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
    fitScore: real('fit_score'),
    category: text('category'),
    remotePolicy: text('remote_policy'),
    details: text('details', { mode: 'json' }).$type<OpportunityDetails>(),
    openStatus: text('open_status'),
    sourceConfidence: text('source_confidence'),
    technologyStack: text('technology_stack'),
    recommendedAction: text('recommended_action'),
    researchPriority: text('research_priority'),
    followUpAt: text('follow_up_at'),
    appliedAt: text('applied_at'),
    lastContactAt: text('last_contact_at'),
    version: integer('version').notNull().default(1),
    updatedRevision: integer('updated_revision').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('applications_job_key_unique').on(table.jobKey),
    index('applications_company_normalized_idx').on(table.companyNormalized),
    index('applications_status_updated_revision_idx').on(
      table.applicationStatus,
      table.updatedRevision
    ),
    index('applications_target_stage_updated_revision_idx').on(
      table.targetStage,
      table.updatedRevision
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
      'applications_fit_score_check',
      sql`${table.fitScore} is null or (${table.fitScore} >= 0 and ${table.fitScore} <= 100)`
    ),
    check(
      'applications_details_json_check',
      sql`${table.details} is null or json_valid(${table.details})`
    ),
    check('applications_version_check', sql`${table.version} >= 1`),
  ]
)
