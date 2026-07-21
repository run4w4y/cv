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

describe('PDF public-page layout assessment', () => {
  test('accepts normal A4 sub-pixel rounding', () => {
    expect(assessCvPageLayout(measurement())).toMatchObject({ status: 'fits' })
  })

  test('rejects vertical and horizontal overflow', () => {
    expect(
      assessCvPageLayout(
        measurement({
          renderedHeightPx: 1_122.52 + cvPageLayoutToleranceCssPixels + 12,
          scrollHeightPx: 1_135,
        })
      ).status
    ).toBe('overflow')
    expect(assessCvPageLayout(measurement({ scrollWidthPx: 799 })).status).toBe(
      'overflow'
    )
  })

  test('rejects missing and invalid public renderer measurements', () => {
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
