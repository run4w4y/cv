import { Effect, Layer } from 'effect'

import { RegistryDatabase } from '../../database'
import {
  findNote,
  listLabels,
  listNotes,
  replaceLabels,
} from '../../persistence/annotations'
import { persistNote } from '../../persistence/note'
import { AnnotationsCrud } from '../../services/annotations'

const makeAnnotationsCrudD1 = Effect.map(RegistryDatabase, (database) =>
  AnnotationsCrud.of({
    findNote: (noteId) => database.use(({ query }) => findNote(query, noteId)),
    listLabels: (applicationId) =>
      database.use(({ query }) => listLabels(query, applicationId)),
    listNotes: (applicationId) =>
      database.use(({ query }) => listNotes(query, applicationId)),
    persistNote: (applicationId, input) =>
      database.use((connections) =>
        persistNote(connections, applicationId, input).pipe(Effect.asVoid)
      ),
    replaceLabels: (applicationId, labels, recordedAt) =>
      database.use((connections) =>
        replaceLabels(connections, applicationId, labels, recordedAt)
      ),
  })
)

export const AnnotationsCrudD1Live = Layer.effect(
  AnnotationsCrud,
  makeAnnotationsCrudD1
)
