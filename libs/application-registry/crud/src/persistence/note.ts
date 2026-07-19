import {
  applicationActivities,
  applicationNotes,
  applications,
  idempotencyReceipts,
} from '@cv/application-registry-entity'
import { eq, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'

import type { RegistryConnections } from '../internal/connection'
import type { PersistedNote } from '../types'
import { allocateRevision, currentRevision, runBatch } from './shared'

export const persistNote = (
  database: RegistryConnections,
  applicationId: string,
  input: PersistedNote
) => {
  const statements = [
    allocateRevision(database.batch),
    database.batch
      .update(applications)
      .set({
        updatedAt: input.recordedAt,
        updatedRevision: currentRevision,
        version: sql`${applications.version} + 1`,
      })
      .where(eq(applications.id, applicationId)),
    database.batch.insert(applicationNotes).values({
      id: input.noteId,
      applicationId,
      kind: input.kind,
      body: input.body,
      source: input.source,
      createdAt: input.recordedAt,
      updatedAt: input.recordedAt,
    }),
    database.batch.insert(applicationActivities).values({
      id: input.activityId,
      applicationId,
      kind: 'note_added',
      actor: 'user',
      source: 'management',
      revision: currentRevision,
      occurredAt: input.recordedAt,
      payload: {
        noteId: input.noteId,
        kind: input.kind,
        source: input.source,
      },
    }),
    database.batch.insert(idempotencyReceipts).values({
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      scope: 'application_note',
      applicationId,
      resourceId: input.noteId,
      createdAt: input.recordedAt,
    }),
  ] satisfies [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(database.batch, 'application note', statements)
}
