import { describe, expect, test } from 'bun:test'

import { contentSecurityPolicy } from './content-security-policy'

describe('CV content security policy', () => {
  test('uses a nonce without unsafe inline scripts in production', () => {
    const policy = contentSecurityPolicy({
      development: false,
      nonce: 'request-nonce',
      preview: false,
    })

    expect(policy).toContain("script-src 'self' 'nonce-request-nonce'")
    expect(policy).not.toContain("'unsafe-inline'")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).toContain("frame-ancestors 'none'")
  })

  test('allows development tooling and isolated preview framing', () => {
    const policy = contentSecurityPolicy({
      development: true,
      nonce: 'request-nonce',
      preview: true,
    })

    expect(policy).toContain("'unsafe-eval'")
    expect(policy).toContain("style-src 'self' 'unsafe-inline'")
    expect(policy).toContain('frame-ancestors *')
  })
})
