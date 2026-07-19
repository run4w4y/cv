import {
  applicationCompensations,
  applicationActivities,
  applicationLabels,
  applications,
  idempotencyReceipts,
  registrySequence,
} from '@cv/application-registry-entity'
import { and, eq, exists, inArray, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'
import { uniq } from 'es-toolkit'

import type { RegistryConnections } from '../internal/connection'
import type { PersistedManagedApplicationUpdate } from '../types'
import { currentRevision, runBatch } from './shared'

const applicationHasVersion = (
  database: RegistryConnections['batch'],
  applicationId: string,
  expectedVersion: number
) =>
  exists(
    database
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, expectedVersion)
        )
      )
  )

const allocateManagedUpdateRevision = (
  database: RegistryConnections['batch'],
  applicationId: string,
  expectedVersion: number
) =>
  database
    .insert(registrySequence)
    .select(
      database
        .select({
          id: sql<number>`1`.as('id'),
          revision: sql<number>`1`.as('revision'),
        })
        .from(sql`(select 1)`)
        .where(applicationHasVersion(database, applicationId, expectedVersion))
    )
    .onConflictDoUpdate({
      target: registrySequence.id,
      set: { revision: sql`${registrySequence.revision} + 1` },
    })

const receiptMatches = (
  database: RegistryConnections['batch'],
  applicationId: string,
  input: PersistedManagedApplicationUpdate
) =>
  exists(
    database
      .select({ idempotencyKey: idempotencyReceipts.idempotencyKey })
      .from(idempotencyReceipts)
      .where(
        and(
          eq(idempotencyReceipts.applicationId, applicationId),
          eq(idempotencyReceipts.scope, 'application_update'),
          eq(idempotencyReceipts.idempotencyKey, input.idempotencyKey),
          eq(idempotencyReceipts.requestHash, input.requestHash)
        )
      )
  )

const activityInsert = (
  database: RegistryConnections['batch'],
  applicationId: string,
  input: PersistedManagedApplicationUpdate
) => {
  const activity = input.activity
  return database.insert(applicationActivities).select(
    database
      .select({
        id: sql<string>`${activity.activityId}`.as('id'),
        applicationId: applications.id,
        kind: sql`${activity.kind}`.as('kind'),
        actor: sql`${activity.actor}`.as('actor'),
        source: sql`${activity.source}`.as('source'),
        revision: currentRevision.as('revision'),
        occurredAt: sql<string>`${activity.occurredAt}`.as('occurred_at'),
        payload: sql`${JSON.stringify(activity.payload)}`.as('payload'),
      })
      .from(applications)
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, input.expectedVersion)
        )
      )
  )
}

const receiptInsert = (
  database: RegistryConnections['batch'],
  applicationId: string,
  input: PersistedManagedApplicationUpdate
) =>
  database.insert(idempotencyReceipts).select(
    database
      .select({
        idempotencyKey: sql<string>`${input.idempotencyKey}`.as(
          'idempotency_key'
        ),
        requestHash: sql<string>`${input.requestHash}`.as('request_hash'),
        scope: sql<'application_update'>`'application_update'`.as('scope'),
        applicationId: applications.id,
        resourceId: sql<string>`${input.activity.activityId}`.as('resource_id'),
        createdAt: sql<string>`${input.recordedAt}`.as('created_at'),
      })
      .from(applications)
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, input.expectedVersion)
        )
      )
  )

const labelStatements = (
  database: RegistryConnections['batch'],
  applicationId: string,
  input: PersistedManagedApplicationUpdate
): readonly BatchItem<'sqlite'>[] => {
  if (input.labels === undefined) return []

  const normalized = uniq(
    input.labels.map((label) => label.trim()).filter(Boolean)
  ).sort()
  const allowed = and(
    applicationHasVersion(database, applicationId, input.expectedVersion),
    receiptMatches(database, applicationId, input)
  )

  return [
    database
      .delete(applicationLabels)
      .where(and(eq(applicationLabels.applicationId, applicationId), allowed)),
    ...normalized.map((label) =>
      database.insert(applicationLabels).select(
        database
          .select({
            applicationId: applications.id,
            label: sql<string>`${label}`.as('label'),
            createdAt: sql<string>`${input.recordedAt}`.as('created_at'),
          })
          .from(applications)
          .where(
            and(
              eq(applications.id, applicationId),
              eq(applications.version, input.expectedVersion),
              receiptMatches(database, applicationId, input)
            )
          )
      )
    ),
  ]
}

const compensationStatements = (
  database: RegistryConnections['batch'],
  applicationId: string,
  input: PersistedManagedApplicationUpdate
): readonly BatchItem<'sqlite'>[] => {
  const annual = input.annualCompensation
  if (annual === undefined) return []

  const allowed = and(
    applicationHasVersion(database, applicationId, input.expectedVersion),
    receiptMatches(database, applicationId, input)
  )
  const statements: BatchItem<'sqlite'>[] = []

  statements.push(
    database
      .delete(applicationCompensations)
      .where(
        and(
          eq(applicationCompensations.applicationId, applicationId),
          eq(applicationCompensations.period, 'year'),
          inArray(applicationCompensations.kind, [
            'base_salary',
            'total_compensation',
          ]),
          allowed
        )
      )
  )

  const replacement = annual.replacement
  if (replacement !== null) {
    statements.push(
      database.insert(applicationCompensations).select(
        database
          .select({
            applicationId: applications.id,
            createdAt: sql<string>`${input.recordedAt}`.as('created_at'),
            currencyCode: sql<string>`${replacement.currencyCode}`.as(
              'currency_code'
            ),
            id: sql<string>`${replacement.id}`.as('id'),
            kind: sql`${replacement.kind}`.as('kind'),
            maximumMinor: sql<number | null>`${replacement.maximumMinor}`.as(
              'maximum_minor'
            ),
            minimumMinor: sql<number | null>`${replacement.minimumMinor}`.as(
              'minimum_minor'
            ),
            period: sql<'year'>`'year'`.as('period'),
            rawText: sql<string | null>`${replacement.rawText}`.as('raw_text'),
            source: sql<string>`${replacement.source}`.as('source'),
            updatedAt: sql<string>`${input.recordedAt}`.as('updated_at'),
          })
          .from(applications)
          .where(
            and(
              eq(applications.id, applicationId),
              eq(applications.version, input.expectedVersion),
              receiptMatches(database, applicationId, input)
            )
          )
      )
    )
  }

  return statements
}

export const updateManagedApplication = (
  database: RegistryConnections,
  applicationId: string,
  input: PersistedManagedApplicationUpdate
) => {
  const statements = [
    allocateManagedUpdateRevision(
      database.batch,
      applicationId,
      input.expectedVersion
    ),
    activityInsert(database.batch, applicationId, input),
    receiptInsert(database.batch, applicationId, input),
    ...labelStatements(database.batch, applicationId, input),
    ...compensationStatements(database.batch, applicationId, input),
    database.batch
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
        updatedRevision: currentRevision,
        version: sql`${applications.version} + 1`,
      })
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, input.expectedVersion),
          receiptMatches(database.batch, applicationId, input)
        )
      ),
  ] satisfies [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(
    database.batch,
    'managed application update',
    statements
  ).pipe(Effect.map((results) => (results.at(-1)?.meta.changes ?? 0) > 0))
}
