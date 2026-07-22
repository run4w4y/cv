import type { GeneratedArtifact } from '@cv/application-registry-entity'
import type { PdfGenerationTriggerEvent } from '@cv/application-registry-events'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  PdfGenerationAttempt,
  ReadyPdfArtifact,
  RequestPdfGenerationInput,
} from '../types'

export interface PdfArtifactsService {
  readonly ensureAttempt: (
    event: PdfGenerationTriggerEvent
  ) => Effect.Effect<GeneratedArtifact, ApplicationRegistryError>
  readonly requestGeneration: (
    applicationIdentifier: string,
    entryId: string,
    input: RequestPdfGenerationInput
  ) => Effect.Effect<{ readonly eventId: string }, ApplicationRegistryError>
  readonly complete: (
    applicationIdentifier: string,
    artifactId: string,
    rendererVersion: string,
    bytes: Uint8Array
  ) => Effect.Effect<GeneratedArtifact, ApplicationRegistryError>
  readonly fail: (
    applicationIdentifier: string,
    artifactId: string,
    errorCode: string,
    errorMessage: string
  ) => Effect.Effect<GeneratedArtifact, ApplicationRegistryError>
  readonly findAttempt: (
    applicationIdentifier: string,
    entryId: string,
    artifactId: string
  ) => Effect.Effect<PdfGenerationAttempt, ApplicationRegistryError>
  readonly findCurrent: (
    applicationIdentifier: string,
    entryId: string,
    rendererVersion?: string
  ) => Effect.Effect<GeneratedArtifact, ApplicationRegistryError>
  readonly readCurrent: (
    applicationIdentifier: string,
    entryId: string,
    rendererVersion?: string
  ) => Effect.Effect<ReadyPdfArtifact, ApplicationRegistryError>
}

export const PdfArtifactsService = Context.Service<PdfArtifactsService>(
  '@cv/application-registry-service/PdfArtifactsService'
)
