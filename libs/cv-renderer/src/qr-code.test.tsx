import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { CvPublicUrlQr } from './qr-code'

describe('CvPublicUrlQr', () => {
  test('encodes and links the exact stable publication URL during SSR', () => {
    const publicUrl =
      'https://cv.example.com/c/token_AbC-123?source=email&view=full#cv'
    const markup = renderToStaticMarkup(
      <a href={publicUrl}>
        <CvPublicUrlQr
          publicUrl={publicUrl}
          title="Open the public CV"
          titleId="public-qr-title"
        />
      </a>
    )

    const escapedUrl = publicUrl.replaceAll('&', '&amp;')
    expect(markup).toContain(`href="${escapedUrl}"`)
    expect(markup).toContain(`data-cv-public-url="${escapedUrl}"`)
    expect(markup).toContain('aria-labelledby="public-qr-title"')
    expect(markup).toContain('<title id="public-qr-title">')
    expect(markup).toContain('<path d="M')
  })

  test('produces stable output and a different matrix for a different URL', () => {
    const render = (publicUrl: string) =>
      renderToStaticMarkup(
        <CvPublicUrlQr
          publicUrl={publicUrl}
          title="Open CV"
          titleId="qr-title"
        />
      )

    const first = render('https://cv.example.com/c/first')
    expect(render('https://cv.example.com/c/first')).toBe(first)
    expect(render('https://cv.example.com/c/second')).not.toBe(first)
  })
})
