import {
  applicationLabels,
  applicationNotes,
  applications,
} from '@cv/application-registry-entity'
import { asc, eq, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'
import { uniq } from 'es-toolkit'

import type { RegistryConnections, RegistryQueryDatabase } from '../database'
import { databaseFailure } from '../errors'
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
  recordedAt: string
) => {
  const normalized = uniq(
    labels.map((label) => label.trim()).filter(Boolean)
  ).sort()
  const statements = [
    allocateRevision(database.batch),
    database.batch
      .update(applications)
      .set({
        updatedAt: recordedAt,
        updatedRevision: currentRevision,
        version: sql`${applications.version} + 1`,
      })
      .where(eq(applications.id, applicationId)),
    database.batch
      .delete(applicationLabels)
      .where(eq(applicationLabels.applicationId, applicationId)),
    ...normalized.map((label) =>
      database.batch.insert(applicationLabels).values({
        applicationId,
        label,
        createdAt: recordedAt,
      })
    ),
  ] satisfies [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(database.batch, 'label replacement', statements).pipe(
    Effect.flatMap(() => listLabels(database.query, applicationId))
  )
}
