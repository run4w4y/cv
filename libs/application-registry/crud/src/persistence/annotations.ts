import {
  applicationLabels,
  applicationNotes,
  applications,
} from '@cv/application-registry-entity'
import { asc, eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { uniq } from 'es-toolkit'

import { databaseFailure } from '../errors'
import type { RegistryDatabase, RegistryExecutor } from '../internal/connection'
import { allocateRevision, runTransaction } from './shared'

export const listLabels = (database: RegistryExecutor, applicationId: string) =>
  database
    .select()
    .from(applicationLabels)
    .where(eq(applicationLabels.applicationId, applicationId))
    .orderBy(asc(applicationLabels.label))
    .pipe(Effect.mapError(databaseFailure('Failed to list application labels')))

export const listNotes = (database: RegistryExecutor, applicationId: string) =>
  database
    .select()
    .from(applicationNotes)
    .where(eq(applicationNotes.applicationId, applicationId))
    .orderBy(asc(applicationNotes.createdAt), asc(applicationNotes.id))
    .pipe(Effect.mapError(databaseFailure('Failed to list application notes')))

export const findNote = (database: RegistryExecutor, noteId: string) =>
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
  database: RegistryDatabase,
  applicationId: string,
  labels: readonly string[],
  recordedAt: string,
  expectedVersion?: number
) => {
  const normalized = uniq(
    labels.map((label) => label.trim()).filter(Boolean)
  ).sort()

  return runTransaction(database, 'label replacement', (transaction) =>
    Effect.gen(function* () {
      const current = yield* transaction
        .select({ version: applications.version })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .for('update')
        .limit(1)

      const row = current.at(0)
      if (
        row === undefined ||
        (expectedVersion !== undefined && row.version !== expectedVersion)
      ) {
        return undefined
      }

      const revision = yield* allocateRevision(transaction)
      yield* transaction
        .delete(applicationLabels)
        .where(eq(applicationLabels.applicationId, applicationId))

      if (normalized.length > 0) {
        yield* transaction.insert(applicationLabels).values(
          normalized.map((label) => ({
            applicationId,
            createdAt: recordedAt,
            label,
          }))
        )
      }

      const updated = yield* transaction
        .update(applications)
        .set({
          updatedAt: recordedAt,
          updatedRevision: revision,
          version: sql`${applications.version} + 1`,
        })
        .where(eq(applications.id, applicationId))
        .returning({ id: applications.id })

      return updated.length === 0
        ? undefined
        : yield* listLabels(transaction, applicationId)
    })
  )
}
