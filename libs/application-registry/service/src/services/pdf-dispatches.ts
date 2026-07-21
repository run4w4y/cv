import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type { PdfGenerationDispatch } from '../types'

export interface PdfDispatchesService {
  readonly markFailed: (
    artifactId: string,
    message: string
  ) => Effect.Effect<void, ApplicationRegistryError>
  readonly markPublished: (
    artifactId: string
  ) => Effect.Effect<void, ApplicationRegistryError>
  readonly pending: (
    limit: number
  ) => Effect.Effect<readonly PdfGenerationDispatch[], ApplicationRegistryError>
}

export const PdfDispatchesService = Context.Service<PdfDispatchesService>(
  '@cv/application-registry-service/PdfDispatchesService'
)
