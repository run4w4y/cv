import { describe, expect, test } from 'bun:test'

import { publicCvBaseUrlFromEnvironment } from './config'

describe('frontend preparation configuration', () => {
  test('trims and normalizes a configured public CV base URL', () => {
    expect(
      publicCvBaseUrlFromEnvironment(
        { VITE_CV_PUBLIC_BASE_URL: '  https://cv.example.test/public///  ' },
        'https://registry.example.test'
      )
    ).toBe('https://cv.example.test/public')
  })

  test('uses the current origin when the configured value is blank', () => {
    expect(
      publicCvBaseUrlFromEnvironment(
        { VITE_CV_PUBLIC_BASE_URL: '   ' },
        'https://registry.example.test'
      )
    ).toBe('https://registry.example.test/c')
  })
})
