import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { createContentEncryptionKey } from '../content-key'
import { bytesToUtf8, utf8ToBytes } from '../encoding'
import {
  PrivateCryptoLayer,
  runPrivateCryptoPromise,
  type WebCryptoApi,
} from '../web-crypto'
import {
  decryptPrivateFilePayload,
  encryptPrivateFilePayload,
  privateFilePayloadMagic,
} from './file'

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

const expectPayloadFailure = async <A, E>(
  effect: Effect.Effect<A, E, WebCryptoApi>,
  reason?: string
) => {
  const result = await runPrivateCryptoExit(effect)
  const rendered = result.toString()

  expect(result._tag).toBe('Failure')
  expect(rendered).toContain('PrivateCryptoPayloadError')
  if (reason) {
    expect(rendered).toContain(reason)
  }
}

describe('AES-GCM private file payloads', () => {
  test('encryptPrivateFilePayload and decryptPrivateFilePayload round trip file bytes', async () => {
    const plaintext = utf8ToBytes('%PDF sample private file')
    const associatedData = utf8ToBytes('file-aad:v2')
    const encrypted = await runPrivateCryptoPromise(
      encryptPrivateFilePayload(payloadKey, plaintext, associatedData)
    )

    expect(encrypted.slice(0, 4)).toEqual(privateFilePayloadMagic)
    expect(bytesToUtf8(encrypted.slice(0, 4))).toBe('PCF2')
    expect(
      bytesToUtf8(
        await runPrivateCryptoPromise(
          decryptPrivateFilePayload(payloadKey, encrypted, associatedData)
        )
      )
    ).toBe('%PDF sample private file')
  })

  test('private file payloads round trip empty file bytes', async () => {
    const encrypted = await runPrivateCryptoPromise(
      encryptPrivateFilePayload(payloadKey, new Uint8Array())
    )
    const plaintext = await runPrivateCryptoPromise(
      decryptPrivateFilePayload(payloadKey, encrypted)
    )

    expect(plaintext).toEqual(new Uint8Array())
  })

  test('decryptPrivateFilePayload rejects associated data mismatches', async () => {
    const encrypted = await runPrivateCryptoPromise(
      encryptPrivateFilePayload(
        payloadKey,
        utf8ToBytes('payload'),
        utf8ToBytes('expected-file-aad')
      )
    )

    await expect(
      runPrivateCryptoPromise(
        decryptPrivateFilePayload(
          payloadKey,
          encrypted,
          utf8ToBytes('wrong-file-aad')
        )
      )
    ).rejects.toThrow()
  })

  test('decryptPrivateFilePayload rejects key mismatches', async () => {
    const associatedData = utf8ToBytes('file-aad:v2')
    const encrypted = await runPrivateCryptoPromise(
      encryptPrivateFilePayload(
        payloadKey,
        utf8ToBytes('payload'),
        associatedData
      )
    )

    await expect(
      runPrivateCryptoPromise(
        decryptPrivateFilePayload(wrongPayloadKey, encrypted, associatedData)
      )
    ).rejects.toThrow()
  })

  test('decryptPrivateFilePayload rejects unsupported headers', async () => {
    const encrypted = await runPrivateCryptoPromise(
      encryptPrivateFilePayload(payloadKey, utf8ToBytes('payload'))
    )
    const tampered = encrypted.slice()
    tampered[0] = 0

    await expectPayloadFailure(
      decryptPrivateFilePayload(payloadKey, tampered),
      'unsupported private file payload'
    )
  })

  test('decryptPrivateFilePayload rejects truncated payloads', async () => {
    const encrypted = await runPrivateCryptoPromise(
      encryptPrivateFilePayload(payloadKey, utf8ToBytes('payload'))
    )

    await expectPayloadFailure(
      decryptPrivateFilePayload(payloadKey, encrypted.slice(0, 8)),
      'truncated private file payload'
    )
  })
})
