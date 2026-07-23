import {
  applicationLabels,
  applicationNotes,
} from '@cv/application-registry-entity'
import { asc, eq } from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure } from '../errors'
import type { RegistryExecutor } from '../internal/connection'

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
