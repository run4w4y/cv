import {
  applicationEvents,
  applicationNotes,
  applications,
  commandReceipts,
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
    database.batch.insert(applicationEvents).values({
      id: input.eventId,
      applicationId,
      kind: 'note_added',
      revision: currentRevision,
      occurredAt: input.recordedAt,
      recordedAt: input.recordedAt,
      deviceId: null,
      payload: {
        noteId: input.noteId,
        kind: input.kind,
        source: input.source,
      },
      operationId: input.operationId,
    }),
    database.batch.insert(commandReceipts).values({
      operationId: input.operationId,
      operationRequestSignature: input.operationRequestSignature,
      kind: 'application_note',
      applicationId,
      eventId: input.eventId,
      noteId: input.noteId,
      recordedAt: input.recordedAt,
    }),
  ] satisfies [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(database.batch, 'application note', statements)
}
