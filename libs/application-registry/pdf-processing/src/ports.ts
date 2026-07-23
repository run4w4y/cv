import type { PdfGenerationTriggerEvent } from '@cv/application-registry-events'
import type {
  ApplicationRegistryError,
  PdfGenerationAttempt,
} from '@cv/application-registry-service'
import { Context, type Effect, Match } from 'effect'

import {
  PdfGenerationPermanentError,
  PdfGenerationTransientError,
} from './model'

export interface PdfArtifactPersistenceShape {
  readonly complete: (
    applicationId: string,
    artifactId: string,
    rendererVersion: string,
    bytes: Uint8Array
  ) => Effect.Effect<
    PdfGenerationAttempt['artifact'],
    PdfGenerationPermanentError | PdfGenerationTransientError
  >
  readonly fail: (
    applicationId: string,
    artifactId: string,
    errorCode: string,
    errorMessage: string
  ) => Effect.Effect<
    PdfGenerationAttempt['artifact'],
    PdfGenerationPermanentError | PdfGenerationTransientError
  >
  readonly ensure: (
    request: PdfGenerationTriggerEvent
  ) => Effect.Effect<
    PdfGenerationAttempt,
    PdfGenerationPermanentError | PdfGenerationTransientError
  >
}

export class PdfArtifactPersistence extends Context.Service<
  PdfArtifactPersistence,
  PdfArtifactPersistenceShape
>()('@cv/application-registry-pdf-processing/PdfArtifactPersistence') {}

export interface PdfRendererShape {
  readonly render: (
    renderUrl: string
  ) => Effect.Effect<
    { readonly bytes: Uint8Array; readonly rendererVersion: string },
    PdfGenerationPermanentError | PdfGenerationTransientError
  >
}

export class PdfRenderer extends Context.Service<
  PdfRenderer,
  PdfRendererShape
>()('@cv/application-registry-pdf-processing/PdfRenderer') {}

const permanentPersistenceError = (
  operation: string,
  cause: ApplicationRegistryError
) =>
  new PdfGenerationPermanentError({
    cause,
    code: 'pdf_generation_invalid',
    message: `PDF generation operation "${operation}" was rejected: ${cause.message}`,
  })

const transientPersistenceError = (
  operation: string,
  cause: ApplicationRegistryError
) =>
  new PdfGenerationTransientError({
    cause,
    code: 'pdf_persistence_failed',
    message: `PDF generation operation "${operation}" failed: ${cause.message}`,
  })

export const mapPdfPersistenceError = (operation: string) =>
  Match.type<ApplicationRegistryError>().pipe(
    Match.tags({
      RegistryAnalyticsError: (cause) =>
        transientPersistenceError(operation, cause),
      RegistryArtifactError: (cause) =>
        transientPersistenceError(operation, cause),
      RegistryBadRequestError: (cause) =>
        permanentPersistenceError(operation, cause),
      RegistryConflictError: (cause) =>
        permanentPersistenceError(operation, cause),
      RegistryDatabaseError: (cause) =>
        transientPersistenceError(operation, cause),
      RegistryEventPublishError: (cause) =>
        transientPersistenceError(operation, cause),
      RegistryNotFoundError: (cause) =>
        permanentPersistenceError(operation, cause),
    }),
    Match.exhaustive
  )
