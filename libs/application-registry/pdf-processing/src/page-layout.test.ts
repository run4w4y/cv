import { describe, expect, test } from 'bun:test'

import {
  assessCvPageLayout,
  type CvPageLayoutMeasurement,
  cvPageLayoutToleranceCssPixels,
} from './page-layout'

const measurement = (
  overrides: Partial<CvPageLayoutMeasurement> = {}
): CvPageLayoutMeasurement => ({
  documentCount: 1,
  pageHeightPx: 1_122.52,
  pageWidthPx: 793.7,
  renderedHeightPx: 1_122.52,
  renderedWidthPx: 793.7,
  scrollHeightPx: 1_123,
  scrollWidthPx: 794,
  ...overrides,
})

describe('PDF render-surface layout assessment', () => {
  test('accepts normal A4 sub-pixel rounding', () => {
    expect(assessCvPageLayout(measurement())).toMatchObject({ status: 'fits' })
  })

  test('accepts multi-page height and estimates its page count', () => {
    expect(
      assessCvPageLayout(
        measurement({
          renderedHeightPx: 1_122.52 * 1.5,
          scrollHeightPx: Math.ceil(1_122.52 * 1.5),
        })
      )
    ).toMatchObject({ estimatedPageCount: 2, status: 'fits' })
  })

  test('rejects horizontal page and document overflow', () => {
    expect(
      assessCvPageLayout(
        measurement({
          renderedWidthPx: 793.7 + cvPageLayoutToleranceCssPixels + 12,
          scrollWidthPx: 806,
        })
      ).status
    ).toBe('overflow')
    expect(
      assessCvPageLayout(
        measurement({ renderedWidthPx: 700, scrollWidthPx: 705 })
      ).status
    ).toBe('overflow')
  })

  test('rejects missing and invalid render-surface measurements', () => {
    expect(assessCvPageLayout(measurement({ documentCount: 0 }))).toEqual({
      documentCount: 0,
      reason: 'document-count',
      status: 'invalid',
    })
    expect(
      assessCvPageLayout(measurement({ pageHeightPx: Number.NaN }))
    ).toEqual({
      documentCount: 1,
      reason: 'invalid-measurement',
      status: 'invalid',
    })
  })
})
