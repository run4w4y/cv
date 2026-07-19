import { PuppeteerWorkers, type BrowserWorker } from '@cloudflare/puppeteer'
import type { PdfGenerationRequested } from '@cv/application-registry-api-contract'
import {
  type ApplicationRegistryError,
  CvPublicationsService,
  type PdfArtifactJob,
  PdfArtifactsService,
} from '@cv/application-registry-service'
import {
  assessCvPageLayout,
  type CvPageLayoutMeasurement,
  cvPageLayoutToleranceCssPixels,
  measureCvPageLayoutInDocument,
} from '@cv/renderer'
import { Context, Effect, Layer, Match } from 'effect'

import { RegistryServiceLayer } from '../layers/registry'
import { WorkerEnv } from '../worker/bindings'
import type { PdfWorkerEnv } from '../worker/types'
import {
  PdfJobPermanentError,
  PdfJobTransientError,
  type PdfPermanentFailureCode,
} from './model'

type CvPageLayoutErrorCode = Extract<
  PdfPermanentFailureCode,
  'cv_page_layout_invalid' | 'cv_page_overflow'
>

export class CvPageLayoutError extends Error {
  readonly code: CvPageLayoutErrorCode

  constructor(code: CvPageLayoutErrorCode, message: string) {
    super(message)
    this.name = 'CvPageLayoutError'
    this.code = code
  }
}

class PublicCvHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Public CV returned HTTP ${status}.`)
    this.name = 'PublicCvHttpError'
    this.status = status
  }
}

export const assertCvFitsSingleA4Page = (
  measurement: CvPageLayoutMeasurement
): void => {
  const assessment = assessCvPageLayout(measurement)
  if (assessment.status === 'fits') return

  if (assessment.status === 'invalid') {
    const message =
      assessment.reason === 'document-count'
        ? `Expected exactly one printable CV document, found ${assessment.documentCount}.`
        : 'The printable CV dimensions could not be measured.'
    throw new CvPageLayoutError('cv_page_layout_invalid', message)
  }

  const overflow: string[] = []
  if (assessment.overflowHeightPx > cvPageLayoutToleranceCssPixels) {
    overflow.push(`${assessment.overflowHeightPx.toFixed(1)} CSS px vertically`)
  }
  if (assessment.overflowWidthPx > cvPageLayoutToleranceCssPixels) {
    overflow.push(
      `${assessment.overflowWidthPx.toFixed(1)} CSS px horizontally`
    )
  }
  throw new CvPageLayoutError(
    'cv_page_overflow',
    `The CV exceeds one A4 page by ${overflow.join(' and ')}.`
  )
}

const messageOf = (cause: unknown): string =>
  (cause instanceof Error ? cause.message : String(cause)).slice(0, 2_000)

const permanentPersistenceError = (
  operation: string,
  cause: ApplicationRegistryError
) =>
  new PdfJobPermanentError({
    cause,
    code: 'pdf_job_invalid',
    message: `PDF job operation "${operation}" was rejected: ${cause.message}`,
    publicationReason: 'PDF generation request is no longer valid.',
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

const persistenceError = (operation: string) =>
  Match.type<ApplicationRegistryError>().pipe(
    Match.tags({
      FactsReleaseObjectMetadataError: (cause) =>
        permanentPersistenceError(operation, cause),
      FactsReleaseObjectNotFoundError: (cause) =>
        permanentPersistenceError(operation, cause),
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

export interface PdfArtifactPersistenceShape {
  readonly complete: (
    applicationId: string,
    artifactId: string,
    bytes: Uint8Array
  ) => Effect.Effect<
    PdfArtifactJob['artifact'],
    PdfJobPermanentError | PdfJobTransientError
  >
  readonly disable: (
    request: PdfGenerationRequested,
    expectedPublicationVersion: number,
    reason: string
  ) => Effect.Effect<void, PdfJobPermanentError | PdfJobTransientError>
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
>()('@cv/cv-pdf-worker/PdfArtifactPersistence') {}

const runRegistry = <A, E>(
  environment: PdfWorkerEnv,
  effect: Effect.Effect<A, E, CvPublicationsService | PdfArtifactsService>
) =>
  effect.pipe(
    Effect.provide(RegistryServiceLayer),
    Effect.provideService(WorkerEnv, environment)
  )

export const makePdfArtifactPersistenceLive = (environment: PdfWorkerEnv) =>
  Layer.effect(
    PdfArtifactPersistence,
    Effect.gen(function* () {
      const complete = Effect.fn('PdfArtifactPersistence.complete')(
        (applicationId: string, artifactId: string, bytes: Uint8Array) =>
          runRegistry(
            environment,
            Effect.gen(function* () {
              const artifacts = yield* PdfArtifactsService
              return yield* artifacts.complete(applicationId, artifactId, bytes)
            })
          ).pipe(Effect.mapError(persistenceError('complete')))
      )

      const disable = Effect.fn('PdfArtifactPersistence.disable')(
        (
          request: PdfGenerationRequested,
          expectedPublicationVersion: number,
          reason: string
        ) =>
          runRegistry(
            environment,
            Effect.gen(function* () {
              const publications = yield* CvPublicationsService
              yield* publications.setAvailability(
                request.applicationId,
                request.entryId,
                {
                  enabled: false,
                  expectedPublicationVersion,
                  reason,
                }
              )
            })
          ).pipe(Effect.mapError(persistenceError('disable')))
      )

      const fail = Effect.fn('PdfArtifactPersistence.fail')(
        (
          applicationId: string,
          artifactId: string,
          errorCode: string,
          errorMessage: string
        ) =>
          runRegistry(
            environment,
            Effect.gen(function* () {
              const artifacts = yield* PdfArtifactsService
              return yield* artifacts.fail(
                applicationId,
                artifactId,
                errorCode,
                errorMessage
              )
            })
          ).pipe(Effect.mapError(persistenceError('fail')))
      )

      const load = Effect.fn('PdfArtifactPersistence.load')(
        (request: PdfGenerationRequested) =>
          runRegistry(
            environment,
            Effect.gen(function* () {
              const artifacts = yield* PdfArtifactsService
              return yield* artifacts.findJob(
                request.applicationId,
                request.entryId,
                request.artifactId
              )
            })
          ).pipe(Effect.mapError(persistenceError('load')))
      )

      return PdfArtifactPersistence.of({ complete, disable, fail, load })
    })
  )

export interface PdfRendererShape {
  readonly render: (
    publicUrl: string
  ) => Effect.Effect<Uint8Array, PdfJobPermanentError | PdfJobTransientError>
}

export class PdfRenderer extends Context.Service<
  PdfRenderer,
  PdfRendererShape
>()('@cv/cv-pdf-worker/PdfRenderer') {}

const renderError = (
  cause: unknown
): PdfJobPermanentError | PdfJobTransientError => {
  if (cause instanceof CvPageLayoutError) {
    return new PdfJobPermanentError({
      cause,
      code: cause.code,
      message: cause.message,
      publicationReason:
        cause.code === 'cv_page_overflow'
          ? 'CV content exceeds one A4 page.'
          : 'CV print layout could not be validated.',
    })
  }

  if (
    cause instanceof PublicCvHttpError &&
    cause.status >= 400 &&
    cause.status < 500 &&
    cause.status !== 408 &&
    cause.status !== 429
  ) {
    return new PdfJobPermanentError({
      cause,
      code: 'pdf_public_page_unavailable',
      message: cause.message,
      publicationReason: 'The public CV page could not be rendered.',
    })
  }

  return new PdfJobTransientError({
    cause,
    code: 'pdf_render_failed',
    message: messageOf(cause),
    ...(cause instanceof PublicCvHttpError && cause.status === 429
      ? { retryAfterSeconds: 20 }
      : {}),
  })
}

export const makePdfRendererLive = (browserBinding: BrowserWorker) =>
  Layer.effect(
    PdfRenderer,
    Effect.gen(function* () {
      const puppeteer = new PuppeteerWorkers()

      const render = Effect.fn('PdfRenderer.render')((publicUrl: string) =>
        Effect.tryPromise({
          try: async () => {
            const browser = await puppeteer.launch(browserBinding)
            try {
              const page = await browser.newPage()
              const response = await page.goto(publicUrl, {
                timeout: 45_000,
                waitUntil: 'networkidle0',
              })
              if (!response?.ok()) {
                throw new PublicCvHttpError(response?.status() ?? 503)
              }

              await page.emulateMediaType('print')
              await page.evaluate(async () => {
                await document.fonts.ready
                await new Promise<void>((resolve) => {
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve())
                  )
                })
              })
              assertCvFitsSingleA4Page(
                await page.evaluate(measureCvPageLayoutInDocument)
              )

              return await page.pdf({
                format: 'A4',
                preferCSSPageSize: true,
                printBackground: true,
              })
            } finally {
              await browser.close()
            }
          },
          catch: renderError,
        })
      )

      return PdfRenderer.of({ render })
    })
  )
