import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import {
  contentEncryptionKeyByteLength,
  contentEncryptionKeyBytes,
  createContentEncryptionKey,
  encodeContentEncryptionKeySecret,
  generateContentEncryptionKey,
  parseContentEncryptionKey,
} from './content-key'
import { base64UrlEncode } from './encoding'
import { runPrivateCryptoPromise } from './web-crypto'

const keyBytes = Uint8Array.from(
  { length: contentEncryptionKeyByteLength },
  (_, index) => index
)

describe('content encryption keys', () => {
  test('createContentEncryptionKey accepts valid 256-bit keys and defensively copies bytes', () => {
    const source = keyBytes.slice()
    const key = Effect.runSync(
      createContentEncryptionKey(source, 'test content key')
    )

    source[0] = 255
    const exported = contentEncryptionKeyBytes(key)
    exported[1] = 255

    expect(key.alg).toBe('PRIVATE-CONTENT-KEY')
    expect(key.byteLength).toBe(contentEncryptionKeyByteLength)
    expect(contentEncryptionKeyBytes(key)).toEqual(keyBytes)
  })

  test('createContentEncryptionKey rejects invalid key lengths with typed errors', async () => {
    const result = await Effect.runPromiseExit(
      createContentEncryptionKey(Uint8Array.from([1, 2, 3]), 'test content key')
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('PrivateCryptoInvalidKeyError')
  })

  test('parseContentEncryptionKey and encodeContentEncryptionKeySecret round trip base64url secrets', async () => {
    const key = Effect.runSync(
      createContentEncryptionKey(keyBytes, 'test content key')
    )
    const secret = encodeContentEncryptionKeySecret(key)

    expect(secret).toBe(`base64url:${base64UrlEncode(keyBytes)}`)
    expect(
      contentEncryptionKeyBytes(
        await Effect.runPromise(parseContentEncryptionKey(secret))
      )
    ).toEqual(keyBytes)
  })

  test('generateContentEncryptionKey creates valid 256-bit content keys', async () => {
    const key = await runPrivateCryptoPromise(generateContentEncryptionKey())

    expect(key.alg).toBe('PRIVATE-CONTENT-KEY')
    expect(contentEncryptionKeyBytes(key)).toHaveLength(
      contentEncryptionKeyByteLength
    )
  })
})
