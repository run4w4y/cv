import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { describeFitScore, FitScore } from './render'

describe('FitScore', () => {
  test('uses useful qualitative score bands', () => {
    expect(describeFitScore(94).label).toBe('Excellent')
    expect(describeFitScore(80).label).toBe('Strong')
    expect(describeFitScore(60).label).toBe('Moderate')
    expect(describeFitScore(20).label).toBe('Low')
  })

  test('renders an accessible score summary', () => {
    const markup = renderToStaticMarkup(<FitScore score={91} />)
    expect(markup).toContain('91 out of 100, Excellent fit')
    expect(markup).toContain('Excellent')
  })
})
