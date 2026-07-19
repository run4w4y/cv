import { describe, expect, test } from 'bun:test'
import { Crypto, Effect } from 'effect'

import { WebCryptoLayer } from './index'

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

describe('WebCryptoLayer', () => {
  test('implements Effect Crypto using the host Web Crypto runtime', async () => {
    const result = await Effect.gen(function* () {
      const crypto = yield* Crypto.Crypto
      const digest = yield* crypto.digest(
        'SHA-256',
        new TextEncoder().encode('abc')
      )
      const uuid = yield* crypto.randomUUIDv4

      return { digest: toHex(digest), uuid }
    }).pipe(Effect.provide(WebCryptoLayer), Effect.runPromise)

    expect(result.digest).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(result.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})
