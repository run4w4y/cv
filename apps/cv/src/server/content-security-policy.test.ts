import { describe, expect, test } from 'bun:test'

import {
  contentSecurityPolicy,
  cvPreviewFrameAncestors,
  normalizeRegistryWebOrigin,
} from './content-security-policy'

describe('CV content security policy', () => {
  test('uses a nonce without unsafe inline scripts in production', () => {
    const policy = contentSecurityPolicy({
      development: false,
      nonce: 'request-nonce',
    })

    expect(policy).toContain("script-src 'self' 'nonce-request-nonce'")
    expect(policy).not.toContain("'unsafe-inline'")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).toContain("frame-ancestors 'none'")
  })

  test('allows development tooling and only explicit preview ancestors', () => {
    const frameAncestors = cvPreviewFrameAncestors({
      development: true,
      registryOrigin: 'https://registry.example.test',
    })
    const policy = contentSecurityPolicy({
      development: true,
      frameAncestors,
      nonce: 'request-nonce',
    })

    expect(policy).toContain("'unsafe-eval'")
    expect(policy).toContain("style-src 'self' 'unsafe-inline'")
    expect(policy).toContain(
      'frame-ancestors https://registry.example.test cv-registry://app http://localhost:4300 http://127.0.0.1:4300'
    )
    expect(policy).not.toContain('frame-ancestors *')
  })

  test('normalizes a production HTTPS origin and fails closed on unsafe input', () => {
    expect(
      normalizeRegistryWebOrigin('https://registry.example.test', false)
    ).toBe('https://registry.example.test')
    expect(() =>
      normalizeRegistryWebOrigin('http://registry.example.test', false)
    ).toThrow('must use HTTPS')
    expect(() =>
      normalizeRegistryWebOrigin('https://user@registry.example.test', false)
    ).toThrow('only its scheme')
    expect(() =>
      normalizeRegistryWebOrigin('https://registry.example.test/path', false)
    ).toThrow('only its scheme')
  })

  test('permits loopback HTTP only in development', () => {
    expect(normalizeRegistryWebOrigin('http://localhost:4300', true)).toBe(
      'http://localhost:4300'
    )
    expect(() =>
      normalizeRegistryWebOrigin('http://localhost:4300', false)
    ).toThrow('must use HTTPS')
  })
})
