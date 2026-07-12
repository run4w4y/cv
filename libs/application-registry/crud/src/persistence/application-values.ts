import {
  applicationCompensations,
  applicationLabels,
  applications,
  applicationWritableKeys,
} from '@cv/application-registry-entity'
import { eq, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { SQLiteInsertValue } from 'drizzle-orm/sqlite-core'
import { uniq } from 'es-toolkit'
import { pick } from 'es-toolkit/object'

import type { RegistryBatchDatabase } from '../internal/connection'
import type {
  ApplicationWriteMode,
  PersistedApplication,
  PersistedCapture,
  PersistedCompensation,
} from '../types'
import { currentRevision, normalizeCompany } from './shared'

export type PersistedOpportunity = PersistedApplication | PersistedCapture

const applicationValues = (
  input: PersistedOpportunity,
  mode: ApplicationWriteMode
): SQLiteInsertValue<typeof applications> => ({
  ...pick(input, applicationWritableKeys),
  id: input.applicationId,
  companyNormalized: normalizeCompany(input.company),
  ...(mode === 'capture'
    ? { applicationStatus: input.applicationStatus ?? 'preparing' }
    : {}),
  updatedRevision: currentRevision,
  createdAt: input.recordedAt,
  updatedAt: input.recordedAt,
})

const applicationUpsertStatement = (
  database: RegistryBatchDatabase,
  input: PersistedOpportunity,
  mode: ApplicationWriteMode
) => {
  const replaceStatus = mode === 'replace'

  return database
    .insert(applications)
    .values(applicationValues(input, mode))
    .onConflictDoUpdate({
      target: applications.jobKey,
      setWhere: eq(applications.id, input.applicationId),
      set: {
        source: sql`excluded.source`,
        sourceJobId: replaceStatus
          ? sql`excluded.source_job_id`
          : sql`coalesce(excluded.source_job_id, ${applications.sourceJobId})`,
        canonicalUrl: sql`excluded.canonical_url`,
        company: sql`excluded.company`,
        companyNormalized: sql`excluded.company_normalized`,
        role: sql`excluded.role`,
        location: replaceStatus
          ? sql`excluded.location`
          : sql`coalesce(excluded.location, ${applications.location})`,
        applicationStatus: replaceStatus
          ? sql`excluded.application_status`
          : sql`case when ${applications.applicationStatus} in ('not_started', 'preparing') then excluded.application_status else ${applications.applicationStatus} end`,
        targetStage: replaceStatus
          ? sql`excluded.target_stage`
          : sql`case when ${applications.targetStage} = 'backlog' then excluded.target_stage else ${applications.targetStage} end`,
        personalPriority: sql`coalesce(excluded.personal_priority, ${applications.personalPriority})`,
        fitScore: sql`coalesce(excluded.fit_score, ${applications.fitScore})`,
        category: sql`coalesce(excluded.category, ${applications.category})`,
        remotePolicy: sql`coalesce(excluded.remote_policy, ${applications.remotePolicy})`,
        details: sql`coalesce(excluded.details, ${applications.details})`,
        openStatus: sql`coalesce(excluded.open_status, ${applications.openStatus})`,
        sourceConfidence: sql`coalesce(excluded.source_confidence, ${applications.sourceConfidence})`,
        technologyStack: sql`coalesce(excluded.technology_stack, ${applications.technologyStack})`,
        recommendedAction: sql`coalesce(excluded.recommended_action, ${applications.recommendedAction})`,
        researchPriority: sql`coalesce(excluded.research_priority, ${applications.researchPriority})`,
        followUpAt: sql`coalesce(excluded.follow_up_at, ${applications.followUpAt})`,
        appliedAt: sql`coalesce(excluded.applied_at, ${applications.appliedAt})`,
        lastContactAt: sql`coalesce(excluded.last_contact_at, ${applications.lastContactAt})`,
        version: sql`${applications.version} + 1`,
        updatedRevision: currentRevision,
        updatedAt: sql`excluded.updated_at`,
      },
    })
}

const normalizedLabels = (labels: readonly string[]) =>
  uniq(labels.map((label) => label.trim()).filter(Boolean)).sort()

export const replacementStatements = (
  database: RegistryBatchDatabase,
  applicationId: string,
  recordedAt: string,
  labels: readonly string[] | undefined,
  compensations: readonly PersistedCompensation[] | undefined
): readonly BatchItem<'sqlite'>[] => [
  ...(labels === undefined
    ? []
    : [
        database
          .delete(applicationLabels)
          .where(eq(applicationLabels.applicationId, applicationId)),
        ...normalizedLabels(labels).map((label) =>
          database.insert(applicationLabels).values({
            applicationId,
            label,
            createdAt: recordedAt,
          })
        ),
      ]),
  ...(compensations === undefined
    ? []
    : [
        database
          .delete(applicationCompensations)
          .where(eq(applicationCompensations.applicationId, applicationId)),
        ...compensations.map((compensation) =>
          database.insert(applicationCompensations).values({
            ...compensation,
            applicationId,
            createdAt: recordedAt,
            updatedAt: recordedAt,
          })
        ),
      ]),
]

export const opportunityStatements = (
  database: RegistryBatchDatabase,
  input: PersistedOpportunity,
  mode: ApplicationWriteMode
): readonly BatchItem<'sqlite'>[] => [
  applicationUpsertStatement(database, input, mode),
  ...replacementStatements(
    database,
    input.applicationId,
    input.recordedAt,
    input.labels,
    input.compensations
  ),
]
