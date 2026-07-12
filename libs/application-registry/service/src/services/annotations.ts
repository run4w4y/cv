import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  AddApplicationNoteInput,
  AddApplicationNoteResult,
  ApplicationAnnotations,
} from '../types'

export interface AnnotationsService {
  readonly addNote: (
    identifier: string,
    input: AddApplicationNoteInput
  ) => Effect.Effect<AddApplicationNoteResult, ApplicationRegistryError>
  readonly list: (
    identifier: string
  ) => Effect.Effect<ApplicationAnnotations, ApplicationRegistryError>
}

export const AnnotationsService = Context.Service<AnnotationsService>(
  '@cv/application-registry-service/AnnotationsService'
)
