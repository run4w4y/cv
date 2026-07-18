import type {
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowTimeoutDuration,
} from 'cloudflare:workers'
import type { BrowserWorker } from '@cloudflare/puppeteer'
import {
  CvPublicationsService,
  PdfArtifactsService,
} from '@cv/application-registry-service'
import {
  assessCvPageLayout,
  type CvPageLayoutMeasurement,
  cvPageLayoutToleranceCssPixels,
  measureCvPageLayoutInDocument,
} from '@cv/renderer'
import { Effect } from 'effect'

import { RegistryServiceLayer } from '../layers/registry'
import { WorkerEnv } from '../worker/bindings'
import type { ApplicationRegistryEnv } from '../worker/types'

export type PdfWorkflowParams = {
  readonly applicationId: string
  readonly entryId: string
  readonly expectedPublicationVersion: number
  readonly publicUrl: string
  readonly rendererVersion: string
}

export type PdfWorkflowEvent = {
  readonly instanceId: string
  readonly payload: Readonly<PdfWorkflowParams>
}

export type PdfWorkflowArtifact = {
  readonly id: string
  readonly publicationVersion: number
  readonly qrTarget: string
  readonly status: 'failed' | 'pending' | 'ready'
}

export type PdfWorkflowResult = {
  readonly artifactId: string
  readonly publicUrl: string
  readonly status: 'ready'
}

export type PdfWorkflowStep = Pick<WorkflowStep, 'do'>

export type PdfWorkflowEnvironment = ApplicationRegistryEnv & {
  readonly BROWSER: BrowserWorker
}

export type PdfWorkflowDependencies = {
  readonly begin: (
    environment: PdfWorkflowEnvironment,
    params: PdfWorkflowParams,
    workflowId: string
  ) => Promise<PdfWorkflowArtifact>
  readonly complete: (
    environment: PdfWorkflowEnvironment,
    applicationId: string,
    artifactId: string,
    bytes: Uint8Array
  ) => Promise<PdfWorkflowArtifact>
  readonly disable: (
    environment: PdfWorkflowEnvironment,
    applicationId: string,
    entryId: string,
    expectedPublicationVersion: number,
    reason: string
  ) => Promise<void>
  readonly fail: (
    environment: PdfWorkflowEnvironment,
    applicationId: string,
    artifactId: string,
    errorCode: string,
    errorMessage: string
  ) => Promise<PdfWorkflowArtifact>
  readonly render: (
    browser: BrowserWorker,
    publicUrl: string
  ) => Promise<Uint8Array>
}

type CvPageLayoutErrorCode = 'cv_page_layout_invalid' | 'cv_page_overflow'

export class CvPageLayoutError extends Error {
  readonly code: CvPageLayoutErrorCode

  constructor(code: CvPageLayoutErrorCode, message: string) {
    super(message)
    this.name = 'CvPageLayoutError'
    this.code = code
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

  const overflow: Array<string> = []
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

const retry = (
  timeout: WorkflowTimeoutDuration,
  limit = 3
): WorkflowStepConfig => ({
  retries: {
    backoff: 'exponential' as const,
    delay: '2 seconds',
    limit,
  },
  timeout,
})

const runRegistry = <A, E>(
  environment: ApplicationRegistryEnv,
  effect: Effect.Effect<A, E, CvPublicationsService | PdfArtifactsService>
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(RegistryServiceLayer),
      Effect.provideService(WorkerEnv, environment)
    )
  )

const renderPublicCv = async (
  browserBinding: BrowserWorker,
  publicUrl: string
): Promise<Uint8Array> => {
  const { default: puppeteer } = await import('@cloudflare/puppeteer')
  const browser = await puppeteer.launch(browserBinding)

  try {
    const page = await browser.newPage()
    const response = await page.goto(publicUrl, {
      timeout: 45_000,
      waitUntil: 'networkidle0',
    })
    if (!response?.ok()) {
      throw new Error(
        `Public CV returned HTTP ${response?.status() ?? 'no response'}.`
      )
    }

    await page.emulateMediaType('print')
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    })
    const measurement = await page.evaluate(measureCvPageLayoutInDocument)
    assertCvFitsSingleA4Page(measurement)

    return await page.pdf({
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
    })
  } finally {
    await browser.close()
  }
}

export const livePdfWorkflowDependencies: PdfWorkflowDependencies = {
  begin: (environment, params, workflowId) =>
    runRegistry(
      environment,
      Effect.gen(function* () {
        const artifacts = yield* PdfArtifactsService
        return yield* artifacts.begin(params.applicationId, params.entryId, {
          expectedPublicationVersion: params.expectedPublicationVersion,
          rendererVersion: params.rendererVersion,
          workflowId,
        })
      })
    ),
  complete: (environment, applicationId, artifactId, bytes) =>
    runRegistry(
      environment,
      Effect.gen(function* () {
        const artifacts = yield* PdfArtifactsService
        return yield* artifacts.complete(applicationId, artifactId, bytes)
      })
    ),
  disable: (
    environment,
    applicationId,
    entryId,
    expectedPublicationVersion,
    reason
  ) =>
    runRegistry(
      environment,
      Effect.gen(function* () {
        const publications = yield* CvPublicationsService
        yield* publications.setAvailability(applicationId, entryId, {
          enabled: false,
          expectedPublicationVersion,
          reason,
        })
      })
    ),
  fail: (environment, applicationId, artifactId, errorCode, errorMessage) =>
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
    ),
  render: renderPublicCv,
}

const streamBytes = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })

const messageOf = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 2_000)

const failureOf = (error: unknown) => {
  if (error instanceof CvPageLayoutError) {
    return {
      code: error.code,
      publicationReason:
        error.code === 'cv_page_overflow'
          ? 'CV content exceeds one A4 page.'
          : 'CV print layout could not be validated.',
    }
  }

  return {
    code: 'pdf_render_failed',
    publicationReason: 'PDF generation did not complete.',
  }
}

export const runPdfWorkflow = async (
  environment: PdfWorkflowEnvironment,
  event: PdfWorkflowEvent,
  step: PdfWorkflowStep,
  dependencies: PdfWorkflowDependencies = livePdfWorkflowDependencies
): Promise<PdfWorkflowResult> => {
  const params = event.payload
  let artifact: PdfWorkflowArtifact | undefined

  try {
    artifact = await step.do(
      'pin approved CV revision',
      retry('1 minute'),
      () => dependencies.begin(environment, params, event.instanceId)
    )
    if (
      artifact.publicationVersion !== params.expectedPublicationVersion ||
      artifact.qrTarget !== params.publicUrl
    ) {
      throw new Error(
        'The PDF job publication identity does not match its persisted artifact.'
      )
    }
    const artifactId = artifact.id

    const durablePdf = await step.do(
      'render exact public CV URL',
      retry('2 minutes', 2),
      async () =>
        streamBytes(
          await dependencies.render(environment.BROWSER, params.publicUrl)
        )
    )
    const pdfBytes = new Uint8Array(
      await new Response(durablePdf).arrayBuffer()
    )

    const ready = await step.do('persist PDF artifact', retry('1 minute'), () =>
      dependencies.complete(
        environment,
        params.applicationId,
        artifactId,
        pdfBytes
      )
    )
    if (
      ready.status !== 'ready' ||
      ready.publicationVersion !== params.expectedPublicationVersion ||
      ready.qrTarget !== params.publicUrl
    ) {
      throw new Error(
        'The persisted PDF is not ready for the exact public URL.'
      )
    }

    return {
      artifactId: ready.id,
      publicUrl: params.publicUrl,
      status: 'ready',
    }
  } catch (error) {
    const message = messageOf(error)
    const failure = failureOf(error)

    if (artifact?.status === 'pending') {
      const pendingArtifact = artifact
      await step.do('record PDF failure', retry('1 minute'), () =>
        dependencies.fail(
          environment,
          params.applicationId,
          pendingArtifact.id,
          failure.code,
          message
        )
      )
    }

    await step.do('disable incomplete publication', retry('1 minute'), () =>
      dependencies.disable(
        environment,
        params.applicationId,
        params.entryId,
        params.expectedPublicationVersion,
        failure.publicationReason
      )
    )
    throw error
  }
}
