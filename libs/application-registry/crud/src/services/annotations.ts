import type {
  ApplicationLabel,
  ApplicationNote,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type { PersistedNote } from '../types'

export interface AnnotationsCrud {
  readonly findNote: (
    noteId: string
  ) => Effect.Effect<ApplicationNote | undefined, RegistryDatabaseError>
  readonly listLabels: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationLabel[], RegistryDatabaseError>
  readonly listNotes: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationNote[], RegistryDatabaseError>
  readonly persistNote: (
    applicationId: string,
    input: PersistedNote
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly replaceLabels: (
    applicationId: string,
    labels: readonly string[],
    recordedAt: string
  ) => Effect.Effect<readonly ApplicationLabel[], RegistryDatabaseError>
}

export const AnnotationsCrud = Context.Service<AnnotationsCrud>(
  '@cv/application-registry-crud/AnnotationsCrud'
)
