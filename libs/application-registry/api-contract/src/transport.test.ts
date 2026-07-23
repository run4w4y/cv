import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

import { normalizeRegistryOrigin, RegistryOriginSchema } from './transport'

describe('RegistryOriginSchema', () => {
  test('normalizes HTTPS origins and removes request-specific URL parts', () => {
    expect(
      normalizeRegistryOrigin(
        '  https://registry.example.test:8443/path?query=true#fragment  '
      )
    ).toBe('https://registry.example.test:8443')
  })

  test('accepts ordinary HTTP and HTTPS URLs without host policy', () => {
    expect(Schema.is(RegistryOriginSchema)('http://localhost:3000/path')).toBe(
      true
    )
    expect(Schema.is(RegistryOriginSchema)('http://127.0.0.1:3000')).toBe(true)
    expect(Schema.is(RegistryOriginSchema)('http://[::1]:3000')).toBe(true)
    expect(
      Schema.is(RegistryOriginSchema)('http://registry.example.test')
    ).toBe(true)
  })

  test('rejects malformed and non-HTTP URLs', () => {
    expect(Schema.is(RegistryOriginSchema)('not a URL')).toBe(false)
    expect(Schema.is(RegistryOriginSchema)('file:///tmp/registry')).toBe(false)
  })
})
