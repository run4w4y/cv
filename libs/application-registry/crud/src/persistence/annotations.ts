import {
  applicationLabels,
  applicationNotes,
  applications,
  registrySequence,
} from '@cv/application-registry-entity'
import { and, asc, eq, exists, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'
import { uniq } from 'es-toolkit'
import { databaseFailure } from '../errors'
import type {
  RegistryConnections,
  RegistryQueryDatabase,
} from '../internal/connection'
import { allocateRevision, currentRevision, runBatch } from './shared'

export const listLabels = (
  database: RegistryQueryDatabase,
  applicationId: string
) =>
  database
    .select()
    .from(applicationLabels)
    .where(eq(applicationLabels.applicationId, applicationId))
    .orderBy(asc(applicationLabels.label))
    .pipe(Effect.mapError(databaseFailure('Failed to list application labels')))

export const listNotes = (
  database: RegistryQueryDatabase,
  applicationId: string
) =>
  database
    .select()
    .from(applicationNotes)
    .where(eq(applicationNotes.applicationId, applicationId))
    .orderBy(asc(applicationNotes.createdAt), asc(applicationNotes.id))
    .pipe(Effect.mapError(databaseFailure('Failed to list application notes')))

export const findNote = (database: RegistryQueryDatabase, noteId: string) =>
  database
    .select()
    .from(applicationNotes)
    .where(eq(applicationNotes.id, noteId))
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to load application note'))
    )

export const replaceLabels = (
  database: RegistryConnections,
  applicationId: string,
  labels: readonly string[],
  recordedAt: string,
  expectedVersion?: number
) => {
  const normalized = uniq(
    labels.map((label) => label.trim()).filter(Boolean)
  ).sort()
  const hasExpectedVersion =
    expectedVersion === undefined
      ? undefined
      : exists(
          database.batch
            .select({ id: applications.id })
            .from(applications)
            .where(
              and(
                eq(applications.id, applicationId),
                eq(applications.version, expectedVersion)
              )
            )
        )
  const allocate =
    expectedVersion === undefined
      ? allocateRevision(database.batch)
      : database.batch
          .insert(registrySequence)
          .select(
            database.batch
              .select({
                id: sql<number>`1`.as('id'),
                revision: sql<number>`1`.as('revision'),
              })
              .from(sql`(select 1)`)
              .where(hasExpectedVersion)
          )
          .onConflictDoUpdate({
            target: registrySequence.id,
            set: { revision: sql`${registrySequence.revision} + 1` },
          })
  const labelInserts = normalized.map((label) =>
    expectedVersion === undefined
      ? database.batch.insert(applicationLabels).values({
          applicationId,
          label,
          createdAt: recordedAt,
        })
      : database.batch.insert(applicationLabels).select(
          database.batch
            .select({
              applicationId: applications.id,
              label: sql<string>`${label}`.as('label'),
              createdAt: sql<string>`${recordedAt}`.as('created_at'),
            })
            .from(applications)
            .where(
              and(
                eq(applications.id, applicationId),
                eq(applications.version, expectedVersion)
              )
            )
        )
  )
  const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
    allocate,
    database.batch
      .delete(applicationLabels)
      .where(
        and(
          eq(applicationLabels.applicationId, applicationId),
          hasExpectedVersion
        )
      ),
    ...labelInserts,
    database.batch
      .update(applications)
      .set({
        updatedAt: recordedAt,
        updatedRevision: currentRevision,
        version: sql`${applications.version} + 1`,
      })
      .where(
        and(
          eq(applications.id, applicationId),
          expectedVersion === undefined
            ? undefined
            : eq(applications.version, expectedVersion)
        )
      ),
  ]

  return runBatch(database.batch, 'label replacement', statements).pipe(
    Effect.flatMap((results) =>
      (results.at(-1)?.meta.changes ?? 0) === 0
        ? Effect.succeed(undefined)
        : listLabels(database.query, applicationId)
    )
  )
}
