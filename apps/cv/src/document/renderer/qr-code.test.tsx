import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { CvPublicUrlQr } from './qr-code'

describe('CvPublicUrlQr', () => {
  test('renders a server-side SVG data URL for the exact publication URL', () => {
    const publicUrl = 'https://cv.example.com/c/token_AbC-123'
    const markup = renderToStaticMarkup(
      <a href={publicUrl}>
        <CvPublicUrlQr publicUrl={publicUrl} title="Open the public CV" />
      </a>
    )

    expect(markup).toContain(`href="${publicUrl}"`)
    expect(markup).toContain(`data-cv-public-url="${publicUrl}"`)
    expect(markup).toContain('alt="Open the public CV"')
    expect(markup).toContain('src="data:image/svg+xml,')
    expect(decodeURIComponent(markup)).toContain('<svg')
    expect(decodeURIComponent(markup)).toContain('<path')
  })

  test('produces stable output and a different image for a different URL', () => {
    const render = (publicUrl: string) =>
      renderToStaticMarkup(
        <CvPublicUrlQr publicUrl={publicUrl} title="Open CV" />
      )

    const first = render('https://cv.example.com/c/first')
    expect(render('https://cv.example.com/c/first')).toBe(first)
    expect(render('https://cv.example.com/c/second')).not.toBe(first)
  })
})
