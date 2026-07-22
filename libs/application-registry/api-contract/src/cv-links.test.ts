import { describe, expect, test } from 'bun:test'

import { cvPreviewUrl } from './cv-links'

describe('cvPreviewUrl', () => {
  test('derives a capability URL without changing the stable public token', () => {
    expect(
      cvPreviewUrl({
        previewToken: 'preview-secret',
        publicUrl: 'https://cv.example.test/c/public-token',
        token: 'public-token',
      })
    ).toBe(
      'https://cv.example.test/c/_preview/public-token?access=preview-secret'
    )
  })

  test('refuses a public URL that does not belong to the link token', () => {
    expect(() =>
      cvPreviewUrl({
        previewToken: 'preview-secret',
        publicUrl: 'https://cv.example.test/c/another-token',
        token: 'public-token',
      })
    ).toThrow('does not end with its token')
  })
})
