import type { PdfGenerationRequested } from '@cv/application-registry-api-contract'
import type {
  ApplicationRegistryError,
  PdfArtifactJob,
} from '@cv/application-registry-service'
import { Context, type Effect, Match } from 'effect'

import { PdfJobPermanentError, PdfJobTransientError } from './model'

export interface PdfArtifactPersistenceShape {
  readonly complete: (
    applicationId: string,
    artifactId: string,
    rendererVersion: string,
    bytes: Uint8Array
  ) => Effect.Effect<
    PdfArtifactJob['artifact'],
    PdfJobPermanentError | PdfJobTransientError
  >
  readonly fail: (
    applicationId: string,
    artifactId: string,
    errorCode: string,
    errorMessage: string
  ) => Effect.Effect<
    PdfArtifactJob['artifact'],
    PdfJobPermanentError | PdfJobTransientError
  >
  readonly load: (
    request: PdfGenerationRequested
  ) => Effect.Effect<
    PdfArtifactJob,
    PdfJobPermanentError | PdfJobTransientError
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
    PdfJobPermanentError | PdfJobTransientError
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
  new PdfJobPermanentError({
    cause,
    code: 'pdf_job_invalid',
    message: `PDF job operation "${operation}" was rejected: ${cause.message}`,
  })

const transientPersistenceError = (
  operation: string,
  cause: ApplicationRegistryError
) =>
  new PdfJobTransientError({
    cause,
    code: 'pdf_persistence_failed',
    message: `PDF job operation "${operation}" failed: ${cause.message}`,
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
      RegistryNotFoundError: (cause) =>
        permanentPersistenceError(operation, cause),
      RegistryQueryTooComplexError: (cause) =>
        permanentPersistenceError(operation, cause),
    }),
    Match.exhaustive
  )
