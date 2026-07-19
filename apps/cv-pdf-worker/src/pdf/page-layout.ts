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
      readonly remainingHeightPx: number
      readonly remainingWidthPx: number
      readonly status: 'fits'
    }
  | {
      readonly documentCount: number
      readonly reason: 'document-count' | 'invalid-measurement'
      readonly status: 'invalid'
    }
  | {
      readonly actualHeightPx: number
      readonly actualWidthPx: number
      readonly overflowHeightPx: number
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
  const documents =
    documentValue.querySelectorAll<HTMLElement>('[data-cv-document]')
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
  const heightOverflows =
    measurement.renderedHeightPx - measurement.pageHeightPx >
      cvPageLayoutToleranceCssPixels ||
    measurement.scrollHeightPx > Math.ceil(measurement.pageHeightPx)
  const widthOverflows =
    measurement.renderedWidthPx - measurement.pageWidthPx >
      cvPageLayoutToleranceCssPixels ||
    measurement.scrollWidthPx > Math.ceil(measurement.pageWidthPx)

  if (heightOverflows || widthOverflows) {
    return {
      actualHeightPx,
      actualWidthPx,
      overflowHeightPx: heightOverflows
        ? Math.max(0, actualHeightPx - measurement.pageHeightPx)
        : 0,
      overflowWidthPx: widthOverflows
        ? Math.max(0, actualWidthPx - measurement.pageWidthPx)
        : 0,
      status: 'overflow',
    }
  }

  return {
    actualHeightPx,
    actualWidthPx,
    remainingHeightPx: Math.max(0, measurement.pageHeightPx - actualHeightPx),
    remainingWidthPx: Math.max(0, measurement.pageWidthPx - actualWidthPx),
    status: 'fits',
  }
}
