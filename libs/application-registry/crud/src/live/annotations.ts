import { Effect, Layer } from 'effect'
import type { RegistryDatabase } from '../internal/connection'
import {
  findNote,
  listLabels,
  listNotes,
  replaceLabels,
} from '../persistence/annotations'
import { persistNote } from '../persistence/note'
import { AnnotationsCrud } from '../services/annotations'

export const makeAnnotationsCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(AnnotationsCrud, {
    findNote: (noteId) => findNote(database, noteId),
    listLabels: (applicationId) => listLabels(database, applicationId),
    listNotes: (applicationId) => listNotes(database, applicationId),
    persistNote: (applicationId, input) =>
      persistNote(database, applicationId, input).pipe(Effect.asVoid),
    replaceLabels: (applicationId, labels, recordedAt, expectedVersion) =>
      replaceLabels(
        database,
        applicationId,
        labels,
        recordedAt,
        expectedVersion
      ),
  })
