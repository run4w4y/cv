import {
  applicationActivities,
  applicationNotes,
  applications,
  idempotencyReceipts,
} from '@cv/application-registry-entity'
import { eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'

import { RegistryDatabaseError } from '../errors'
import type { RegistryDatabase } from '../internal/connection'
import type { PersistedNote } from '../types'
import { allocateRevision, runTransaction } from './shared'

export const persistNote = (
  database: RegistryDatabase,
  applicationId: string,
  input: PersistedNote
) =>
  runTransaction(database, 'application note', (transaction) =>
    Effect.gen(function* () {
      const current = yield* transaction
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .for('update')
        .limit(1)

      if (current.length === 0) {
        return yield* new RegistryDatabaseError({
          cause: new Error(`Application ${applicationId} does not exist.`),
          message: 'Failed to execute application note',
        })
      }

      yield* transaction.insert(idempotencyReceipts).values({
        applicationId,
        createdAt: input.recordedAt,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        resourceId: input.noteId,
        scope: 'application_note',
      })

      const revision = yield* allocateRevision(transaction)
      yield* transaction
        .update(applications)
        .set({
          updatedAt: input.recordedAt,
          updatedRevision: revision,
          version: sql`${applications.version} + 1`,
        })
        .where(eq(applications.id, applicationId))

      yield* transaction.insert(applicationNotes).values({
        applicationId,
        body: input.body,
        createdAt: input.recordedAt,
        id: input.noteId,
        kind: input.kind,
        source: input.source,
        updatedAt: input.recordedAt,
      })

      yield* transaction.insert(applicationActivities).values({
        actor: 'user',
        applicationId,
        id: input.activityId,
        kind: 'note_added',
        occurredAt: input.recordedAt,
        payload: {
          kind: input.kind,
          noteId: input.noteId,
          source: input.source,
        },
        revision,
        source: 'management',
      })
    })
  )
