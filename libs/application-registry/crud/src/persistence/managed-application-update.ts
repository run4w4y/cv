import {
  applicationCompensations,
  applicationEvents,
  applicationLabels,
  applications,
  commandReceipts,
  registrySequence,
} from '@cv/application-registry-entity'
import { and, eq, exists, inArray, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'
import { uniq } from 'es-toolkit'

import type { RegistryConnections } from '../internal/connection'
import type { PersistedManagedApplicationUpdate } from '../types'
import { currentRevision, normalizeCompany, runBatch } from './shared'

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
      .select({ operationId: commandReceipts.operationId })
      .from(commandReceipts)
      .where(
        and(
          eq(commandReceipts.applicationId, applicationId),
          eq(commandReceipts.kind, 'managed_application_update'),
          eq(commandReceipts.operationId, input.operationId),
          eq(
            commandReceipts.operationRequestSignature,
            input.operationRequestSignature
          )
        )
      )
  )

const eventInsert = (
  database: RegistryConnections['batch'],
  applicationId: string,
  input: PersistedManagedApplicationUpdate
) => {
  const event = input.event
  if (event === undefined) return undefined

  return database.insert(applicationEvents).select(
    database
      .select({
        id: sql<string>`${event.eventId}`.as('id'),
        applicationId: applications.id,
        kind: sql`${event.kind}`.as('kind'),
        revision: currentRevision.as('revision'),
        occurredAt: sql<string>`${event.occurredAt}`.as('occurred_at'),
        recordedAt: sql<string>`${event.recordedAt}`.as('recorded_at'),
        deviceId: sql<string | null>`${event.deviceId}`.as('device_id'),
        payload: sql`${JSON.stringify(event.payload)}`.as('payload'),
        operationId: sql<string>`${event.operationId}`.as('operation_id'),
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
  database.insert(commandReceipts).select(
    database
      .select({
        operationId: sql<string>`${input.operationId}`.as('operation_id'),
        operationRequestSignature:
          sql<string>`${input.operationRequestSignature}`.as(
            'operation_request_signature'
          ),
        kind: sql<'managed_application_update'>`'managed_application_update'`.as(
          'kind'
        ),
        applicationId: applications.id,
        eventId: sql<string | null>`${input.event?.eventId ?? null}`.as(
          'event_id'
        ),
        noteId: sql<null>`null`.as('note_id'),
        recordedAt: sql<string>`${input.recordedAt}`.as('recorded_at'),
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
  const eventStatement = eventInsert(database.batch, applicationId, input)
  const statements = [
    allocateManagedUpdateRevision(
      database.batch,
      applicationId,
      input.expectedVersion
    ),
    ...(eventStatement === undefined ? [] : [eventStatement]),
    receiptInsert(database.batch, applicationId, input),
    ...labelStatements(database.batch, applicationId, input),
    ...compensationStatements(database.batch, applicationId, input),
    database.batch
      .update(applications)
      .set({
        ...input.patch,
        ...(input.patch.company === undefined
          ? {}
          : { companyNormalized: normalizeCompany(input.patch.company) }),
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
