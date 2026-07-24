/** Allows only floating-point noise in sub-pixel DOM rectangles. */
export const cvPageLayoutToleranceCssPixels = 0.05

export type CvPageLayoutMeasurement = {
  readonly documentCount: number
  readonly pageHeightPx: number
  readonly pageWidthPx: number
  readonly renderedHeightPx: number
  readonly renderedWidthPx: number
  readonly scrollHeightPx: number
  readonly scrollWidthPx: number
}

export type CvPageLayoutAssessment =
  | {
      readonly actualHeightPx: number
      readonly actualWidthPx: number
      readonly estimatedPageCount: number
      readonly remainingWidthPx: number
      readonly status: 'fits'
    }
  | {
      readonly documentCount: number
      readonly reason: 'document-count' | 'invalid-measurement'
      readonly status: 'invalid'
    }
  | {
      readonly actualWidthPx: number
      readonly overflowWidthPx: number
      readonly status: 'overflow'
    }

type CvLayoutDocument = {
  readonly documentElement: HTMLElement
  readonly createElement: (tagName: 'div') => HTMLDivElement
  readonly querySelectorAll: <T extends Element>(
    selectors: string
  ) => NodeListOf<T>
}

/**
 * Measures the application-owned printable document. This function has no
 * module-level runtime dependencies so Puppeteer can serialize it.
 */
export const measureCvPageLayoutInDocument = (
  documentValue: CvLayoutDocument = document as unknown as CvLayoutDocument
): CvPageLayoutMeasurement => {
  const documents = documentValue.querySelectorAll<HTMLElement>(
    '[data-cv-pdf-document]'
  )
  const pageProbe = documentValue.createElement('div')
  pageProbe.setAttribute('aria-hidden', 'true')
  pageProbe.style.cssText =
    'position:fixed;left:-10000px;top:-10000px;width:210mm;height:297mm;padding:0;border:0;margin:0;visibility:hidden;pointer-events:none'
  documentValue.documentElement.appendChild(pageProbe)
  const pageRectangle = pageProbe.getBoundingClientRect()
  pageProbe.remove()

  const cvDocument = documents.item(0)
  const documentRectangle = cvDocument?.getBoundingClientRect()

  return {
    documentCount: documents.length,
    pageHeightPx: pageRectangle.height,
    pageWidthPx: pageRectangle.width,
    renderedHeightPx: documentRectangle?.height ?? 0,
    renderedWidthPx: documentRectangle?.width ?? 0,
    scrollHeightPx: cvDocument?.scrollHeight ?? 0,
    scrollWidthPx: cvDocument?.scrollWidth ?? 0,
  }
}

const isValidDimension = (value: number) => Number.isFinite(value) && value > 0

export const assessCvPageLayout = (
  measurement: CvPageLayoutMeasurement
): CvPageLayoutAssessment => {
  if (measurement.documentCount !== 1) {
    return {
      documentCount: measurement.documentCount,
      reason: 'document-count',
      status: 'invalid',
    }
  }

  const dimensions = [
    measurement.pageHeightPx,
    measurement.pageWidthPx,
    measurement.renderedHeightPx,
    measurement.renderedWidthPx,
    measurement.scrollHeightPx,
    measurement.scrollWidthPx,
  ]
  if (!dimensions.every(isValidDimension)) {
    return {
      documentCount: measurement.documentCount,
      reason: 'invalid-measurement',
      status: 'invalid',
    }
  }

  const actualHeightPx = Math.max(
    measurement.renderedHeightPx,
    measurement.scrollHeightPx
  )
  const actualWidthPx = Math.max(
    measurement.renderedWidthPx,
    measurement.scrollWidthPx
  )
  const widthOverflows =
    measurement.renderedWidthPx - measurement.pageWidthPx >
      cvPageLayoutToleranceCssPixels ||
    measurement.scrollWidthPx > Math.ceil(measurement.renderedWidthPx)

  if (widthOverflows) {
    return {
      actualWidthPx,
      overflowWidthPx: Math.max(
        0,
        actualWidthPx -
          Math.min(measurement.pageWidthPx, measurement.renderedWidthPx)
      ),
      status: 'overflow',
    }
  }

  return {
    actualHeightPx,
    actualWidthPx,
    estimatedPageCount: Math.max(
      1,
      Math.ceil(actualHeightPx / measurement.pageHeightPx)
    ),
    remainingWidthPx: Math.max(0, measurement.pageWidthPx - actualWidthPx),
    status: 'fits',
  }
}
