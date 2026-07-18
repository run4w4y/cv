import type { GeneratedArtifact } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type { BeginPdfArtifactInput, ReadyPdfArtifact } from '../types'

export interface PdfArtifactsService {
  readonly begin: (
    applicationIdentifier: string,
    entryId: string,
    input: BeginPdfArtifactInput
  ) => Effect.Effect<GeneratedArtifact, ApplicationRegistryError>
  readonly complete: (
    applicationIdentifier: string,
    artifactId: string,
    bytes: Uint8Array
  ) => Effect.Effect<GeneratedArtifact, ApplicationRegistryError>
  readonly fail: (
    applicationIdentifier: string,
    artifactId: string,
    errorCode: string,
    errorMessage: string
  ) => Effect.Effect<GeneratedArtifact, ApplicationRegistryError>
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
