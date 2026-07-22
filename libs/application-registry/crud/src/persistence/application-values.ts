import {
  applicationActivities,
  applicationCompensations,
  applicationLabels,
  applications,
  applicationWritableKeys,
} from '@cv/application-registry-entity'
import { eq } from 'drizzle-orm'
import type { PgInsertValue } from 'drizzle-orm/pg-core'
import { Effect } from 'effect'
import { uniq } from 'es-toolkit'
import { pick } from 'es-toolkit/object'

import type { RegistryExecutor } from '../internal/connection'
import type { PersistedApplication, PersistedCompensation } from '../types'

export const applicationValues = (
  input: PersistedApplication,
  revision: number
): PgInsertValue<typeof applications> => ({
  ...pick(input, applicationWritableKeys),
  id: input.applicationId,
  postingFingerprint: input.postingFingerprint,
  postingUrlNormalized: input.postingUrlNormalized,
  updatedRevision: revision,
  createdAt: input.recordedAt,
  updatedAt: input.recordedAt,
})

const normalizedLabels = (labels: readonly string[]) =>
  uniq(labels.map((label) => label.trim()).filter(Boolean)).sort()

export const replaceApplicationValues = (
  database: RegistryExecutor,
  applicationId: string,
  recordedAt: string,
  labels: readonly string[] | undefined,
  compensations: readonly PersistedCompensation[] | undefined
) =>
  Effect.gen(function* () {
    if (labels !== undefined) {
      yield* database
        .delete(applicationLabels)
        .where(eq(applicationLabels.applicationId, applicationId))

      const values = normalizedLabels(labels).map((label) => ({
        applicationId,
        label,
        createdAt: recordedAt,
      }))
      if (values.length > 0) {
        yield* database.insert(applicationLabels).values(values)
      }
    }

    if (compensations !== undefined) {
      yield* database
        .delete(applicationCompensations)
        .where(eq(applicationCompensations.applicationId, applicationId))

      if (compensations.length > 0) {
        yield* database.insert(applicationCompensations).values(
          compensations.map((compensation) => ({
            ...compensation,
            applicationId,
            createdAt: recordedAt,
            updatedAt: recordedAt,
          }))
        )
      }
    }
  })

export const persistApplicationAggregate = (
  database: RegistryExecutor,
  input: PersistedApplication,
  revision: number
) =>
  Effect.gen(function* () {
    const inserted = yield* database
      .insert(applications)
      .values(applicationValues(input, revision))
      .onConflictDoNothing()
      .returning({ id: applications.id })

    if (inserted.length === 0) return false

    yield* database.insert(applicationActivities).values({
      actor: input.activity.actor,
      applicationId: input.applicationId,
      id: input.activity.activityId,
      kind: input.activity.kind,
      occurredAt: input.activity.occurredAt,
      payload: input.activity.payload,
      revision,
      source: input.activity.source,
    })

    yield* replaceApplicationValues(
      database,
      input.applicationId,
      input.recordedAt,
      input.labels,
      input.compensations
    )
    return true
  })
