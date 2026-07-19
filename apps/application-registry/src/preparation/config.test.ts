import { describe, expect, test } from 'bun:test'

import { Redacted } from 'effect'
import {
  factsR2OptionsFromEnvironment,
  publicCvBaseUrlFromEnvironment,
} from './config'

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

describe('private facts R2 configuration', () => {
  test('builds the account endpoint and redacts browser credentials', () => {
    const options = factsR2OptionsFromEnvironment({
      VITE_FACTS_R2_ACCESS_KEY_ID: 'read-access-key',
      VITE_FACTS_R2_ACCOUNT_ID: 'a'.repeat(32),
      VITE_FACTS_R2_BUCKET: 'cv-facts',
      VITE_FACTS_R2_SECRET_ACCESS_KEY: 'read-secret-key',
    })

    expect(options.endpoint).toBe(
      `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`
    )
    expect(options.bucket).toBe('cv-facts')
    expect(String(options.secretAccessKey)).not.toContain(
      Redacted.value(options.secretAccessKey)
    )
  })
})
