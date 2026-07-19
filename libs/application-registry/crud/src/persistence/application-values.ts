import {
  applicationActivities,
  applicationCompensations,
  applicationLabels,
  applications,
  applicationWritableKeys,
} from '@cv/application-registry-entity'
import { eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { SQLiteInsertValue } from 'drizzle-orm/sqlite-core'
import { uniq } from 'es-toolkit'
import { pick } from 'es-toolkit/object'

import type { RegistryBatchDatabase } from '../internal/connection'
import type { PersistedApplication, PersistedCompensation } from '../types'
import { currentRevision } from './shared'

const applicationValues = (
  input: PersistedApplication
): SQLiteInsertValue<typeof applications> => ({
  ...pick(input, applicationWritableKeys),
  id: input.applicationId,
  postingFingerprint: input.postingFingerprint,
  postingUrlNormalized: input.postingUrlNormalized,
  updatedRevision: currentRevision,
  createdAt: input.recordedAt,
  updatedAt: input.recordedAt,
})

const applicationInsertStatement = (
  database: RegistryBatchDatabase,
  input: PersistedApplication
) => {
  return database.insert(applications).values(applicationValues(input))
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
  applicationInsertStatement(database, input),
  database.insert(applicationActivities).values({
    actor: input.activity.actor,
    applicationId: input.applicationId,
    id: input.activity.activityId,
    kind: input.activity.kind,
    occurredAt: input.activity.occurredAt,
    payload: input.activity.payload,
    revision: currentRevision,
    source: input.activity.source,
  }),
  ...replacementStatements(
    database,
    input.applicationId,
    input.recordedAt,
    input.labels,
    input.compensations
  ),
]
