import type { D1Database } from '@cloudflare/workers-types'
import { Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import {
  findNote,
  listLabels,
  listNotes,
  replaceLabels,
} from '../persistence/annotations'
import { persistNote } from '../persistence/note'
import { AnnotationsCrud } from '../services/annotations'

export const makeAnnotationsCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(AnnotationsCrud, {
    findNote: (noteId) =>
      withRegistryConnections(database, ({ query }) => findNote(query, noteId)),
    listLabels: (applicationId) =>
      withRegistryConnections(database, ({ query }) =>
        listLabels(query, applicationId)
      ),
    listNotes: (applicationId) =>
      withRegistryConnections(database, ({ query }) =>
        listNotes(query, applicationId)
      ),
    persistNote: (applicationId, input) =>
      withRegistryConnections(database, (connections) =>
        persistNote(connections, applicationId, input).pipe(Effect.asVoid)
      ),
    replaceLabels: (applicationId, labels, recordedAt) =>
      withRegistryConnections(database, (connections) =>
        replaceLabels(connections, applicationId, labels, recordedAt)
      ),
  })
