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
import type { PersistedApplication, PersistedCompensation } from '../types'
import { currentRevision, normalizeCompany } from './shared'

const applicationValues = (
  input: PersistedApplication
): SQLiteInsertValue<typeof applications> => ({
  ...pick(input, applicationWritableKeys),
  id: input.applicationId,
  companyNormalized: normalizeCompany(input.company),
  updatedRevision: currentRevision,
  createdAt: input.recordedAt,
  updatedAt: input.recordedAt,
})

const applicationUpsertStatement = (
  database: RegistryBatchDatabase,
  input: PersistedApplication
) => {
  return database
    .insert(applications)
    .values(applicationValues(input))
    .onConflictDoUpdate({
      target: applications.jobKey,
      setWhere: eq(applications.id, input.applicationId),
      set: {
        source: sql`excluded.source`,
        sourceJobId: sql`excluded.source_job_id`,
        canonicalUrl: sql`excluded.canonical_url`,
        company: sql`excluded.company`,
        companyNormalized: sql`excluded.company_normalized`,
        role: sql`excluded.role`,
        location: sql`excluded.location`,
        applicationStatus: sql`excluded.application_status`,
        targetStage: sql`excluded.target_stage`,
        personalPriority: sql`coalesce(excluded.personal_priority, ${applications.personalPriority})`,
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

export const applicationStatements = (
  database: RegistryBatchDatabase,
  input: PersistedApplication
): readonly BatchItem<'sqlite'>[] => [
  applicationUpsertStatement(database, input),
  ...replacementStatements(
    database,
    input.applicationId,
    input.recordedAt,
    input.labels,
    input.compensations
  ),
]
