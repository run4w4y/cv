import { describe, expect, test } from 'bun:test'

import { cvPdfRenderUrl, cvWebPreviewUrl } from './cv-links'

describe('CV capability links', () => {
  const link = {
    previewToken: 'preview-secret',
    publicUrl: 'https://cv.example.test/c/public-token',
    token: 'public-token',
  } as const

  test('derives separate web-preview and PDF-render URLs', () => {
    expect(cvWebPreviewUrl(link)).toBe(
      'https://cv.example.test/c/_preview/public-token?access=preview-secret'
    )
    expect(
      cvPdfRenderUrl({
        ...link,
        previewToken: 'preview secret/with punctuation',
      })
    ).toBe(
      'https://cv.example.test/c/_render/public-token?access=preview+secret%2Fwith+punctuation'
    )
  })

  test('refuses a public URL that does not belong to the link token', () => {
    expect(() =>
      cvWebPreviewUrl({
        ...link,
        publicUrl: 'https://cv.example.test/c/another-token',
      })
    ).toThrow('does not end with its token')
    expect(() =>
      cvWebPreviewUrl({
        ...link,
        publicUrl: 'https://cv.example.test/c/prefix-public-token',
      })
    ).toThrow('does not end with its token')
  })

  test('permits loopback HTTP for development without weakening remote links', () => {
    expect(
      cvWebPreviewUrl({
        ...link,
        publicUrl: 'http://localhost:4381/c/public-token',
      })
    ).toBe(
      'http://localhost:4381/c/_preview/public-token?access=preview-secret'
    )
    expect(() =>
      cvWebPreviewUrl({
        ...link,
        publicUrl: 'http://cv.example.test/c/public-token',
      })
    ).toThrow('must use HTTPS')
  })

  test('refuses credentials, queries, and fragments in canonical URLs', () => {
    expect(() =>
      cvWebPreviewUrl({
        ...link,
        publicUrl: 'https://user:password@cv.example.test/c/public-token',
      })
    ).toThrow('must not contain credentials')
    expect(() =>
      cvWebPreviewUrl({
        ...link,
        publicUrl: 'https://cv.example.test/c/public-token?source=registry',
      })
    ).toThrow('must not contain a query or fragment')
    expect(() =>
      cvWebPreviewUrl({
        ...link,
        publicUrl: 'https://cv.example.test/c/public-token#fragment',
      })
    ).toThrow('must not contain a query or fragment')
  })
})
