import { describe, expect, test } from 'bun:test'

import type { CvPageLayoutMeasurement } from './page-layout'
import {
  assertCvHasValidPageLayout,
  assertCvPdfPageCount,
  CvPageLayoutError,
} from './rendering'

const measurement = (
  overrides: Partial<CvPageLayoutMeasurement> = {}
): CvPageLayoutMeasurement => ({
  documentCount: 1,
  pageHeightPx: 1_122.52,
  pageWidthPx: 793.7,
  renderedHeightPx: 1_650,
  renderedWidthPx: 687.87,
  scrollHeightPx: 1_650,
  scrollWidthPx: 688,
  ...overrides,
})

describe('PDF render validation', () => {
  test('accepts a valid multi-page document layout', () => {
    expect(() => assertCvHasValidPageLayout(measurement())).not.toThrow()
  })

  test('rejects invalid and horizontally overflowing layouts', () => {
    expect(() =>
      assertCvHasValidPageLayout(measurement({ documentCount: 0 }))
    ).toThrow(CvPageLayoutError)
    expect(() =>
      assertCvHasValidPageLayout(
        measurement({ renderedWidthPx: 687.87, scrollWidthPx: 700 })
      )
    ).toThrow('overflows horizontally')
  })

  test('accepts one or two pages and rejects larger PDFs', () => {
    expect(() => assertCvPdfPageCount(1)).not.toThrow()
    expect(() => assertCvPdfPageCount(2)).not.toThrow()
    expect(() => assertCvPdfPageCount(3)).toThrow(
      'The CV renders to 3 A4 pages; at most 2 are allowed.'
    )
  })

  test('rejects invalid page-count measurements', () => {
    expect(() => assertCvPdfPageCount(0)).toThrow(
      'page count could not be validated'
    )
    expect(() => assertCvPdfPageCount(1.5)).toThrow(
      'page count could not be validated'
    )
  })
})
