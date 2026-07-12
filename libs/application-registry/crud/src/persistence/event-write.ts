import {
  type ApplicationStatus,
  applicationEvents,
  applications,
  commandReceipts,
  registrySequence,
} from '@cv/application-registry-entity'
import { and, eq, exists, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'

import type { RegistryConnections } from '../database'
import type { PersistedEvent } from '../types'
import { currentRevision, runBatch } from './shared'

const allocateEventRevision = (
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
        .where(
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
        )
    )
    .onConflictDoUpdate({
      target: registrySequence.id,
      set: { revision: sql`${registrySequence.revision} + 1` },
    })

const eventInsert = (
  database: RegistryConnections['batch'],
  applicationId: string,
  expectedVersion: number,
  input: PersistedEvent
) =>
  database.insert(applicationEvents).select(
    database
      .select({
        id: sql<string>`${input.eventId}`.as('id'),
        applicationId: applications.id,
        kind: sql`${input.kind}`.as('kind'),
        revision: currentRevision.as('revision'),
        occurredAt: sql<string>`${input.occurredAt}`.as('occurred_at'),
        recordedAt: sql<string>`${input.recordedAt}`.as('recorded_at'),
        deviceId: sql<string | null>`${input.deviceId}`.as('device_id'),
        payload: sql`${JSON.stringify(input.payload)}`.as('payload'),
        operationId: sql<string>`${input.operationId}`.as('operation_id'),
      })
      .from(applications)
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, expectedVersion)
        )
      )
  )

const eventReceiptInsert = (
  database: RegistryConnections['batch'],
  input: PersistedEvent
) =>
  database.insert(commandReceipts).select(
    database
      .select({
        operationId: applicationEvents.operationId,
        requestFingerprint: sql<string>`${input.requestFingerprint}`.as(
          'request_fingerprint'
        ),
        kind: sql<'application_event'>`'application_event'`.as('kind'),
        applicationId: applicationEvents.applicationId,
        eventId: applicationEvents.id,
        captureId: sql<null>`null`.as('capture_id'),
        noteId: sql<null>`null`.as('note_id'),
        recordedAt: sql<string>`${input.recordedAt}`.as('recorded_at'),
      })
      .from(applicationEvents)
      .where(eq(applicationEvents.operationId, input.operationId))
  )

export const persistEvent = (
  database: RegistryConnections,
  applicationId: string,
  expectedVersion: number,
  nextApplicationStatus: ApplicationStatus | undefined,
  input: PersistedEvent
) => {
  const eventExists = exists(
    database.batch
      .select({ id: applicationEvents.id })
      .from(applicationEvents)
      .where(eq(applicationEvents.operationId, input.operationId))
  )
  const statements = [
    allocateEventRevision(database.batch, applicationId, expectedVersion),
    eventInsert(database.batch, applicationId, expectedVersion, input),
    database.batch
      .update(applications)
      .set({
        ...(nextApplicationStatus === undefined
          ? {}
          : { applicationStatus: nextApplicationStatus }),
        version: sql`${applications.version} + 1`,
        updatedRevision: currentRevision,
        updatedAt: input.recordedAt,
      })
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, expectedVersion),
          eventExists
        )
      ),
    eventReceiptInsert(database.batch, input),
  ] satisfies [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(database.batch, 'application event', statements).pipe(
    Effect.map((results) => (results.at(-1)?.meta.changes ?? 0) > 0)
  )
}
