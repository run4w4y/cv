import {
  applicationActivities,
  applicationCompensations,
  applicationLabels,
  applications,
  idempotencyReceipts,
} from '@cv/application-registry-entity'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { uniq } from 'es-toolkit'

import type { RegistryDatabase } from '../internal/connection'
import type { PersistedManagedApplicationUpdate } from '../types'
import { allocateRevision, runTransaction } from './shared'

const normalizedLabels = (labels: readonly string[]) =>
  uniq(labels.map((label) => label.trim()).filter(Boolean)).sort()

export const updateManagedApplication = (
  database: RegistryDatabase,
  applicationId: string,
  input: PersistedManagedApplicationUpdate
) =>
  runTransaction(database, 'managed application update', (transaction) =>
    Effect.gen(function* () {
      const current = yield* transaction
        .select({ version: applications.version })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .for('update')
        .limit(1)

      const row = current.at(0)
      if (row === undefined || row.version !== input.expectedVersion) {
        return false
      }

      yield* transaction.insert(idempotencyReceipts).values({
        applicationId,
        createdAt: input.recordedAt,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        resourceId: input.activity.activityId,
        scope: 'application_update',
      })

      const revision = yield* allocateRevision(transaction)

      yield* transaction.insert(applicationActivities).values({
        actor: input.activity.actor,
        applicationId,
        id: input.activity.activityId,
        kind: input.activity.kind,
        occurredAt: input.activity.occurredAt,
        payload: input.activity.payload,
        revision,
        source: input.activity.source,
      })

      if (input.labels !== undefined) {
        yield* transaction
          .delete(applicationLabels)
          .where(eq(applicationLabels.applicationId, applicationId))

        const labels = normalizedLabels(input.labels).map((label) => ({
          applicationId,
          createdAt: input.recordedAt,
          label,
        }))
        if (labels.length > 0) {
          yield* transaction.insert(applicationLabels).values(labels)
        }
      }

      if (input.annualCompensation !== undefined) {
        yield* transaction
          .delete(applicationCompensations)
          .where(
            and(
              eq(applicationCompensations.applicationId, applicationId),
              eq(applicationCompensations.period, 'year'),
              inArray(applicationCompensations.kind, [
                'base_salary',
                'total_compensation',
              ])
            )
          )

        const replacement = input.annualCompensation.replacement
        if (replacement !== null) {
          yield* transaction.insert(applicationCompensations).values({
            ...replacement,
            applicationId,
            createdAt: input.recordedAt,
            period: 'year',
            updatedAt: input.recordedAt,
          })
        }
      }

      const updated = yield* transaction
        .update(applications)
        .set({
          ...input.patch,
          ...(input.postingIdentity === undefined
            ? {}
            : {
                postingFingerprint: input.postingIdentity.fingerprint,
                postingUrlNormalized: input.postingIdentity.normalizedUrl,
              }),
          updatedAt: input.recordedAt,
          updatedRevision: revision,
          version: sql`${applications.version} + 1`,
        })
        .where(
          and(
            eq(applications.id, applicationId),
            eq(applications.version, row.version)
          )
        )
        .returning({ id: applications.id })

      return updated.length > 0
    })
  )
