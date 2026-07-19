import { type BrowserWorker, PuppeteerWorkers } from '@cloudflare/puppeteer'
import type { PdfGenerationRequested } from '@cv/application-registry-api-contract'
import {
  type ApplicationRegistryError,
  type PdfArtifactJob,
  PdfArtifactsService,
} from '@cv/application-registry-service'
import { Context, Effect, Layer, Match } from 'effect'

import { RegistryServiceLayer } from '../layers/registry'
import { WorkerEnv } from '../worker/bindings'
import type { PdfWorkerEnv } from '../worker/types'
import {
  PdfJobPermanentError,
  PdfJobTransientError,
  type PdfPermanentFailureCode,
} from './model'
import {
  assessCvPageLayout,
  type CvPageLayoutMeasurement,
  cvPageLayoutToleranceCssPixels,
  measureCvPageLayoutInDocument,
} from './page-layout'

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

class CvRenderPageHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`CV render page returned HTTP ${status}.`)
    this.name = 'CvRenderPageHttpError'
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
>()('@cv/cv-pdf-worker/PdfArtifactPersistence') {}

const runRegistry = <A, E>(
  environment: PdfWorkerEnv,
  effect: Effect.Effect<A, E, PdfArtifactsService>
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
        (
          applicationId: string,
          artifactId: string,
          rendererVersion: string,
          bytes: Uint8Array
        ) =>
          runRegistry(
            environment,
            Effect.gen(function* () {
              const artifacts = yield* PdfArtifactsService
              return yield* artifacts.complete(
                applicationId,
                artifactId,
                rendererVersion,
                bytes
              )
            })
          ).pipe(Effect.mapError(persistenceError('complete')))
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

      return PdfArtifactPersistence.of({ complete, fail, load })
    })
  )

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
>()('@cv/cv-pdf-worker/PdfRenderer') {}

const renderError = (
  cause: unknown
): PdfJobPermanentError | PdfJobTransientError => {
  if (cause instanceof CvPageLayoutError) {
    return new PdfJobPermanentError({
      cause,
      code: cause.code,
      message: cause.message,
    })
  }

  if (
    cause instanceof CvRenderPageHttpError &&
    cause.status >= 400 &&
    cause.status < 500 &&
    cause.status !== 408 &&
    cause.status !== 429
  ) {
    return new PdfJobPermanentError({
      cause,
      code: 'pdf_public_page_unavailable',
      message: cause.message,
    })
  }

  return new PdfJobTransientError({
    cause,
    code: 'pdf_render_failed',
    message: messageOf(cause),
    ...(cause instanceof CvRenderPageHttpError && cause.status === 429
      ? { retryAfterSeconds: 20 }
      : {}),
  })
}

export const makePdfRendererLive = (browserBinding: BrowserWorker) =>
  Layer.effect(
    PdfRenderer,
    Effect.gen(function* () {
      const puppeteer = new PuppeteerWorkers()

      const render = Effect.fn('PdfRenderer.render')((renderUrl: string) =>
        Effect.tryPromise({
          try: async () => {
            const browser = await puppeteer.launch(browserBinding)
            try {
              const page = await browser.newPage()
              const response = await page.goto(renderUrl, {
                timeout: 45_000,
                waitUntil: 'networkidle0',
              })
              if (!response?.ok()) {
                throw new CvRenderPageHttpError(response?.status() ?? 503)
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

              const rendererVersion = await page.evaluate(() =>
                document
                  .querySelector<HTMLElement>('[data-cv-document]')
                  ?.dataset.cvRenderVersion?.trim()
              )
              if (!rendererVersion) {
                throw new CvPageLayoutError(
                  'cv_page_layout_invalid',
                  'The CV render page did not identify its render version.'
                )
              }

              return {
                bytes: await page.pdf({
                  format: 'A4',
                  preferCSSPageSize: true,
                  printBackground: true,
                }),
                rendererVersion,
              }
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
