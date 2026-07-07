import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import {
  base64UrlDecode,
  base64UrlEncode,
  bytesToUtf8,
  normalizeSecretBytes,
  utf8ToBytes,
} from './encoding'

describe('encoding helpers', () => {
  test('base64UrlEncode and base64UrlDecode round trip bytes without padding', async () => {
    const bytes = Uint8Array.from([0, 1, 2, 253, 254, 255])
    const encoded = base64UrlEncode(bytes)

    expect(encoded).toBe('AAEC_f7_')
    expect(await Effect.runPromise(base64UrlDecode(encoded))).toEqual(bytes)
    expect(encoded.includes('=')).toBe(false)
  })

  test('base64UrlDecode rejects malformed input with typed errors', async () => {
    await expect(Effect.runPromise(base64UrlDecode('!!!!'))).rejects.toThrow(
      'Invalid base64url value'
    )
    const result = await Effect.runPromiseExit(base64UrlDecode('a'))

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('PrivateCryptoInvalidBase64UrlError')
  })

  test('UTF-8 helpers preserve text content', () => {
    expect(bytesToUtf8(utf8ToBytes('private-cv'))).toBe('private-cv')
  })

  test('normalizeSecretBytes accepts plain, base64, and base64url secrets', async () => {
    expect(
      bytesToUtf8(await Effect.runPromise(normalizeSecretBytes('secret')))
    ).toBe('secret')
    expect(
      bytesToUtf8(
        await Effect.runPromise(normalizeSecretBytes('base64:c2VjcmV0'))
      )
    ).toBe('secret')
    expect(
      bytesToUtf8(
        await Effect.runPromise(normalizeSecretBytes('base64url:c2VjcmV0'))
      )
    ).toBe('secret')
  })
})
