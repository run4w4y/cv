import { describe, expect, test } from 'bun:test'
import type { DesktopFetchRequest } from '@cv/application-registry-desktop-contract'

import {
  isAllowedDesktopExternalRequest,
  isRegistryDesktopRequest,
} from './network'

const request = (url: string, method = 'GET'): DesktopFetchRequest => ({
  body: null,
  headers: [],
  method,
  url,
})

describe('desktop external network policy', () => {
  test('recognizes only the exact registry namespace', () => {
    expect(isRegistryDesktopRequest('/api/registry')).toBe(true)
    expect(isRegistryDesktopRequest('/api/registry/applications')).toBe(true)
    expect(isRegistryDesktopRequest('/api/registry-evil')).toBe(false)
    expect(isRegistryDesktopRequest('/api/registryevil')).toBe(false)
  })

  test('allows only the client FX rate-table request', () => {
    const input = request('https://api.frankfurter.dev/v2/rates?base=USD')

    expect(isAllowedDesktopExternalRequest(input, new URL(input.url))).toBe(
      true
    )
  })

  test('rejects other Frankfurter paths, methods, and query parameters', () => {
    const inputs = [
      request('https://api.frankfurter.dev/v2/currencies'),
      request('https://api.frankfurter.dev/v2/rates?base=USD&from=2020-01-01'),
      request('https://api.frankfurter.dev/v2/rates?base=USD', 'POST'),
      request('https://example.com/v2/rates?base=USD'),
    ]

    expect(
      inputs.every(
        (input) => !isAllowedDesktopExternalRequest(input, new URL(input.url))
      )
    ).toBe(true)
  })
})
