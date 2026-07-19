import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { CvRendererStyleSheet, cvRendererStyles } from './styles'

describe('CV renderer stylesheet', () => {
  test('contains scoped responsive, forced-preview, and A4 print rules', () => {
    expect(cvRendererStyles).toContain(':where([data-cv-document])')
    expect(cvRendererStyles).toContain(
      '[data-cv-renderer-mode="print-preview"]'
    )
    expect(cvRendererStyles).toContain('@page')
    expect(cvRendererStyles).toContain('size: A4')
    expect(cvRendererStyles).toContain('@media print')
    expect(cvRendererStyles).toContain('width: 210mm')
    expect(cvRendererStyles).toContain('min-height: 297mm')
  })

  test('renders a deterministic CSP-nonce-compatible style element', () => {
    const first = renderToStaticMarkup(
      <CvRendererStyleSheet nonce="test-nonce" />
    )
    const second = renderToStaticMarkup(
      <CvRendererStyleSheet nonce="test-nonce" />
    )

    expect(second).toBe(first)
    expect(first).toContain('nonce="test-nonce"')
    expect(first).toContain('data-cv-renderer-styles="true"')
  })
})
