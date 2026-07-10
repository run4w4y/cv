import { describe, expect, test } from 'bun:test'
import { decodeWebBaseUrl, resolveWebBaseUrl } from './web-base-url'

describe('web base URL', () => {
  test('normalizes root and path-prefixed URLs as directories', () => {
    expect(decodeWebBaseUrl('https://cv.example.test').href).toBe(
      'https://cv.example.test/'
    )
    expect(decodeWebBaseUrl('https://cv.example.test/cv').href).toBe(
      'https://cv.example.test/cv/'
    )
  })

  test('rejects non-web URLs and URL state that is unsafe for a base', () => {
    expect(() => decodeWebBaseUrl('file:///tmp/cv')).toThrow()
    expect(() => decodeWebBaseUrl('https://user@cv.example.test/')).toThrow()
    expect(() => decodeWebBaseUrl('https://cv.example.test/?draft=1')).toThrow()
    expect(() => decodeWebBaseUrl('https://cv.example.test/#section')).toThrow()
  })

  test('keeps resolved paths below the configured deployment path', () => {
    const baseUrl = decodeWebBaseUrl('https://cv.example.test/cv')

    expect(resolveWebBaseUrl(baseUrl, '/en/').href).toBe(
      'https://cv.example.test/cv/en/'
    )
    expect(() => resolveWebBaseUrl(baseUrl, '../admin')).toThrow(
      'cannot contain dot segments'
    )
    expect(() => resolveWebBaseUrl(baseUrl, '%2e%2e/admin')).toThrow(
      'cannot contain dot segments'
    )
  })
})
