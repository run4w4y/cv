import { describe, expect, test } from 'bun:test'

import {
  normalizeCvWebOrigin,
  registryContentSecurityPolicy,
} from './cv-web-origin'

describe('CV web origin', () => {
  test('normalizes a production HTTPS origin', () => {
    expect(normalizeCvWebOrigin('https://cv.example.test', false)).toBe(
      'https://cv.example.test'
    )
  })

  test('fails closed on insecure or non-origin production values', () => {
    expect(() => normalizeCvWebOrigin('http://cv.example.test', false)).toThrow(
      'must use HTTPS'
    )
    expect(() =>
      normalizeCvWebOrigin('https://user@cv.example.test', false)
    ).toThrow('only its scheme')
    expect(() =>
      normalizeCvWebOrigin('https://cv.example.test/c/', false)
    ).toThrow('only its scheme')
  })

  test('permits loopback HTTP only for development', () => {
    expect(normalizeCvWebOrigin('http://localhost:4381', true)).toBe(
      'http://localhost:4381'
    )
    expect(() => normalizeCvWebOrigin('http://localhost:4381', false)).toThrow(
      'must use HTTPS'
    )
  })

  test('allows frames from only the configured CV origin and existing blobs', () => {
    const policy = registryContentSecurityPolicy('https://cv.example.test')

    expect(policy).toContain('frame-src blob: https://cv.example.test')
    expect(policy).not.toContain('frame-src *')
    expect(policy).not.toContain('frame-src http:')
    expect(policy).not.toContain('frame-src https:')
  })
})
