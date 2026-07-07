import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { createContentEncryptionKey } from '../content-key'
import { base64UrlDecode, bytesToUtf8, utf8ToBytes } from '../encoding'
import {
  PrivateCryptoLayer,
  runPrivateCryptoPromise,
  type WebCryptoApi,
} from '../web-crypto'
import {
  decryptAesGcmPayload,
  type EncryptedPayload,
  encryptAesGcmPayload,
} from './payload'

const payloadKeyBytes = Uint8Array.from({ length: 32 }, (_, index) => index)
const wrongPayloadKeyBytes = Uint8Array.from(
  { length: 32 },
  (_, index) => 255 - index
)
const payloadKey = Effect.runSync(
  createContentEncryptionKey(payloadKeyBytes, 'payload key')
)
const wrongPayloadKey = Effect.runSync(
  createContentEncryptionKey(wrongPayloadKeyBytes, 'wrong payload key')
)

const runPrivateCryptoExit = <A, E>(
  effect: Effect.Effect<A, E, WebCryptoApi>
) => Effect.runPromiseExit(effect.pipe(Effect.provide(PrivateCryptoLayer)))

describe('AES-GCM payloads', () => {
  test('encryptAesGcmPayload and decryptAesGcmPayload round trip payload bytes', async () => {
    const plaintext = utf8ToBytes(JSON.stringify({ hello: 'private cv' }))
    const associatedData = utf8ToBytes('payload-aad:v1')
    const encrypted = await runPrivateCryptoPromise(
      encryptAesGcmPayload(payloadKey, plaintext, associatedData)
    )

    expect(encrypted.alg).toBe('AES-GCM')
    expect(await Effect.runPromise(base64UrlDecode(encrypted.iv))).toHaveLength(
      12
    )
    expect(
      bytesToUtf8(
        await runPrivateCryptoPromise(
          decryptAesGcmPayload(payloadKey, encrypted, associatedData)
        )
      )
    ).toBe('{"hello":"private cv"}')
  })

  test('decryptAesGcmPayload rejects unsupported payload algorithms', async () => {
    const encrypted = await runPrivateCryptoPromise(
      encryptAesGcmPayload(payloadKey, utf8ToBytes('payload'))
    )
    Object.defineProperty(encrypted, 'alg', { value: 'AES-CBC' })
    const result = await runPrivateCryptoExit(
      decryptAesGcmPayload(payloadKey, encrypted)
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('PrivateCryptoPayloadError')
  })

  test('decryptAesGcmPayload rejects associated data mismatches', async () => {
    const encrypted = await runPrivateCryptoPromise(
      encryptAesGcmPayload(
        payloadKey,
        utf8ToBytes('payload'),
        utf8ToBytes('expected-aad')
      )
    )

    await expect(
      runPrivateCryptoPromise(
        decryptAesGcmPayload(payloadKey, encrypted, utf8ToBytes('wrong-aad'))
      )
    ).rejects.toThrow()
  })

  test('decryptAesGcmPayload rejects key mismatches', async () => {
    const encrypted = await runPrivateCryptoPromise(
      encryptAesGcmPayload(
        payloadKey,
        utf8ToBytes('payload'),
        utf8ToBytes('payload-aad')
      )
    )

    await expect(
      runPrivateCryptoPromise(
        decryptAesGcmPayload(
          wrongPayloadKey,
          encrypted,
          utf8ToBytes('payload-aad')
        )
      )
    ).rejects.toThrow()
  })

  test('decryptAesGcmPayload rejects malformed base64url payload fields', async () => {
    const payload = {
      alg: 'AES-GCM',
      ciphertext: '!!!!',
      iv: 'bad',
    } satisfies EncryptedPayload
    const result = await runPrivateCryptoExit(
      decryptAesGcmPayload(payloadKey, payload)
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('PrivateCryptoInvalidBase64UrlError')
  })
})
