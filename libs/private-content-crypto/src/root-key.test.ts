import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { contentEncryptionKeyBytes } from './content-key'
import { base64UrlEncode } from './encoding'
import {
  createPrivateContentRootKey,
  deriveProfileContentKey,
  parsePrivateContentRootKey,
  privateContentRootKeyByteLength,
} from './root-key'
import { runPrivateCryptoPromise } from './web-crypto'

const rootBytes = Uint8Array.from(
  { length: privateContentRootKeyByteLength },
  (_, index) => index + 1
)

const otherRootBytes = Uint8Array.from(
  { length: privateContentRootKeyByteLength },
  (_, index) => index + 51
)

describe('private content root keys', () => {
  test('parsePrivateContentRootKey accepts base64url 256-bit roots', async () => {
    const key = await Effect.runPromise(
      parsePrivateContentRootKey(`base64url:${base64UrlEncode(rootBytes)}`)
    )

    expect(key.alg).toBe('PRIVATE-CONTENT-ROOT-KEY')
    expect(key.byteLength).toBe(privateContentRootKeyByteLength)
  })

  test('parsePrivateContentRootKey rejects invalid root key lengths', async () => {
    const result = await Effect.runPromiseExit(
      parsePrivateContentRootKey('too-short')
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('PrivateCryptoInvalidKeyError')
  })

  test('deriveProfileContentKey is deterministic and profile-scoped', async () => {
    const rootKey = Effect.runSync(createPrivateContentRootKey(rootBytes))
    const otherRootKey = Effect.runSync(
      createPrivateContentRootKey(otherRootBytes)
    )
    const first = await runPrivateCryptoPromise(
      deriveProfileContentKey({ profileId: 'p_frontend', rootKey })
    )
    const second = await runPrivateCryptoPromise(
      deriveProfileContentKey({ profileId: 'p_frontend', rootKey })
    )
    const otherProfile = await runPrivateCryptoPromise(
      deriveProfileContentKey({ profileId: 'p_backend', rootKey })
    )
    const otherRoot = await runPrivateCryptoPromise(
      deriveProfileContentKey({
        profileId: 'p_frontend',
        rootKey: otherRootKey,
      })
    )

    expect(contentEncryptionKeyBytes(first)).toEqual(
      contentEncryptionKeyBytes(second)
    )
    expect(contentEncryptionKeyBytes(first)).not.toEqual(
      contentEncryptionKeyBytes(otherProfile)
    )
    expect(contentEncryptionKeyBytes(first)).not.toEqual(
      contentEncryptionKeyBytes(otherRoot)
    )
  })
})
