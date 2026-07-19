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

describe('CV A4 page layout assessment', () => {
  test('accepts the normal sub-pixel rounding at the A4 boundary', () => {
    expect(assessCvPageLayout(measurement())).toMatchObject({
      status: 'fits',
    })
  })

  test('rejects vertical and horizontal content overflow', () => {
    const vertical = assessCvPageLayout(
      measurement({
        renderedHeightPx: 1_122.52 + cvPageLayoutToleranceCssPixels + 12,
        scrollHeightPx: 1_135,
      })
    )
    expect(vertical.status).toBe('overflow')
    if (vertical.status === 'overflow') {
      expect(vertical.overflowHeightPx).toBeCloseTo(12.48)
      expect(vertical.overflowWidthPx).toBe(0)
    }

    const horizontal = assessCvPageLayout(
      measurement({
        scrollWidthPx: 799,
      })
    )
    expect(horizontal.status).toBe('overflow')
    if (horizontal.status === 'overflow') {
      expect(horizontal.overflowHeightPx).toBe(0)
      expect(horizontal.overflowWidthPx).toBeCloseTo(5.3)
    }
  })

  test('rejects missing, duplicate, and nonsensical renderer measurements', () => {
    expect(assessCvPageLayout(measurement({ documentCount: 0 }))).toEqual({
      documentCount: 0,
      reason: 'document-count',
      status: 'invalid',
    })
    expect(assessCvPageLayout(measurement({ documentCount: 2 }))).toEqual({
      documentCount: 2,
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
