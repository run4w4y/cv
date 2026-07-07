import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import {
  PrivateCryptoLayer,
  runPrivateCryptoPromise,
  WebCryptoApi,
} from './web-crypto'

describe('WebCryptoApi service', () => {
  test('PrivateCryptoLayer resolves the global Web Crypto implementation', async () => {
    const crypto = await Effect.runPromise(
      WebCryptoApi.pipe(Effect.provide(PrivateCryptoLayer))
    )

    expect(crypto.subtle).toBeDefined()
    expect(crypto.getRandomValues).toBeDefined()
  })

  test('runPrivateCryptoPromise provides the live WebCryptoApi layer', async () => {
    const hasCrypto = await runPrivateCryptoPromise(
      WebCryptoApi.pipe(
        Effect.map((crypto) => Boolean(crypto.subtle && crypto.getRandomValues))
      )
    )

    expect(hasCrypto).toBe(true)
  })
})
