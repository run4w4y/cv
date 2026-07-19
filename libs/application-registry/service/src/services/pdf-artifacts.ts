import type { GeneratedArtifact } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  PdfArtifactJob,
  PdfGenerationDispatch,
  ReadyPdfArtifact,
  StartPdfJobInput,
} from '../types'

export interface PdfArtifactsService {
  readonly startJob: (
    applicationIdentifier: string,
    entryId: string,
    input: StartPdfJobInput
  ) => Effect.Effect<GeneratedArtifact, ApplicationRegistryError>
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
  readonly findJob: (
    applicationIdentifier: string,
    entryId: string,
    artifactId: string
  ) => Effect.Effect<PdfArtifactJob, ApplicationRegistryError>
  readonly findPendingDispatch: (
    artifactId: string
  ) => Effect.Effect<
    PdfGenerationDispatch | undefined,
    ApplicationRegistryError
  >
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
  readonly markDispatchFailed: (
    artifactId: string,
    message: string
  ) => Effect.Effect<void, ApplicationRegistryError>
  readonly markDispatched: (
    artifactId: string
  ) => Effect.Effect<void, ApplicationRegistryError>
  readonly pendingDispatches: (
    limit: number
  ) => Effect.Effect<readonly PdfGenerationDispatch[], ApplicationRegistryError>
}

export const PdfArtifactsService = Context.Service<PdfArtifactsService>(
  '@cv/application-registry-service/PdfArtifactsService'
)
