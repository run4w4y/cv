import { describe, expect, test } from 'bun:test'

import { registryCvWebPreviewUrl } from './cv-web-preview'

const link = {
  previewToken: 'preview-secret',
  publicUrl: 'https://cv.example.test/c/public-token',
  token: 'public-token',
} as const

describe('Registry CV web preview URL', () => {
  test('accepts only the explicitly configured CV origin', () => {
    expect(
      registryCvWebPreviewUrl(link, {
        development: false,
        environment: {
          VITE_CV_WEB_ORIGIN: 'https://cv.example.test',
        },
      })
    ).toBe(
      'https://cv.example.test/c/_preview/public-token?access=preview-secret'
    )
    expect(() =>
      registryCvWebPreviewUrl(link, {
        development: false,
        environment: {
          VITE_CV_WEB_ORIGIN: 'https://other-cv.example.test',
        },
      })
    ).toThrow('does not match VITE_CV_WEB_ORIGIN')
  })

  test('allows a configured loopback fixture only in development', () => {
    expect(
      registryCvWebPreviewUrl(
        {
          ...link,
          publicUrl: 'http://localhost:4381/c/public-token',
        },
        {
          development: true,
          environment: {
            VITE_CV_WEB_ORIGIN: 'http://localhost:4381',
          },
        }
      )
    ).toStartWith('http://localhost:4381/c/_preview/')
  })
})
