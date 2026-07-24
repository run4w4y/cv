import { Match, Predicate, Schema } from 'effect'

import {
  PdfGenerationPermanentError,
  PdfGenerationTransientError,
  type PdfPermanentFailureCode,
} from './model'
import { assessCvPageLayout, type CvPageLayoutMeasurement } from './page-layout'

export const cvPdfMaximumPageCount = 2

type CvPageLayoutErrorCode = Extract<
  PdfPermanentFailureCode,
  'cv_page_layout_invalid' | 'cv_page_overflow'
>

const CvPageLayoutErrorCodeSchema = Schema.Literals([
  'cv_page_layout_invalid',
  'cv_page_overflow',
])

export class CvPageLayoutError extends Schema.TaggedErrorClass<CvPageLayoutError>()(
  'CvPageLayoutError',
  {
    code: CvPageLayoutErrorCodeSchema,
    message: Schema.String,
  }
) {
  constructor(code: CvPageLayoutErrorCode, message: string) {
    super({ code, message })
  }
}

export class CvRenderPageHttpError extends Schema.TaggedErrorClass<CvRenderPageHttpError>()(
  'CvRenderPageHttpError',
  { message: Schema.String, status: Schema.Number }
) {
  constructor(status: number) {
    super({ message: `CV render page returned HTTP ${status}.`, status })
  }
}

export const assertCvHasValidPageLayout = (
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

  throw new CvPageLayoutError(
    'cv_page_overflow',
    `The printable CV overflows horizontally by ${assessment.overflowWidthPx.toFixed(1)} CSS px.`
  )
}

export const assertCvPdfPageCount = (
  pageCount: number,
  maximumPageCount = cvPdfMaximumPageCount
): void => {
  if (
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    !Number.isInteger(maximumPageCount) ||
    maximumPageCount < 1
  ) {
    throw new CvPageLayoutError(
      'cv_page_layout_invalid',
      'The generated PDF page count could not be validated.'
    )
  }
  if (pageCount <= maximumPageCount) return

  throw new CvPageLayoutError(
    'cv_page_overflow',
    `The CV renders to ${pageCount} A4 pages; at most ${maximumPageCount} are allowed.`
  )
}

const messageOf = (cause: unknown): string =>
  Match.value(cause)
    .pipe(
      Match.when(Predicate.isError, (error) => error.message),
      Match.orElse(String)
    )
    .slice(0, 2_000)

export const mapPdfRenderError = (
  cause: unknown
): PdfGenerationPermanentError | PdfGenerationTransientError =>
  Match.value(cause).pipe(
    Match.when(
      Schema.is(CvPageLayoutError),
      (error) =>
        new PdfGenerationPermanentError({
          cause: error,
          code: error.code,
          message: error.message,
        })
    ),
    Match.when(Schema.is(CvRenderPageHttpError), (error) => {
      if (
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      ) {
        return new PdfGenerationPermanentError({
          cause: error,
          code: 'pdf_public_page_unavailable',
          message: error.message,
        })
      }
      return new PdfGenerationTransientError({
        cause: error,
        code: 'pdf_render_failed',
        message: error.message,
        ...(error.status === 429 ? { retryAfterSeconds: 20 } : {}),
      })
    }),
    Match.orElse(
      (renderCause) =>
        new PdfGenerationTransientError({
          cause: renderCause,
          code: 'pdf_render_failed',
          message: messageOf(renderCause),
        })
    )
  )
