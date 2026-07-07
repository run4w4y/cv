import { describe, expect, test } from 'bun:test'
import {
  base64UrlDecode,
  base64UrlEncode,
  contentEncryptionKeyBytes,
  createContentEncryptionKey,
  runPrivateCryptoPromise,
} from '@cv/private-content-crypto'
import { Effect } from 'effect'
import {
  decodePrivateAudienceId,
  decodePrivateCapabilityToken,
  encodePrivateAudienceId,
  looksLikePrivateAudienceId,
  mintPrivateCapabilityToken,
  PRIVATE_CAPABILITY_TOKEN_VERSION,
  parsePrivateAudienceCodecKey,
} from './index'

const profileKeyBytes = Uint8Array.from({ length: 32 }, (_, index) => index)
const profileKey = Effect.runSync(
  createContentEncryptionKey(profileKeyBytes, 'profile content key')
)
const audienceKey = Effect.runSync(
  parsePrivateAudienceCodecKey(
    'test-private-audience-key-with-at-least-thirty-two-bytes'
  )
)

describe('private capability tokens', () => {
  test('encodes private audience ids deterministically and reversibly', async () => {
    const first = await runPrivateCryptoPromise(
      encodePrivateAudienceId({
        audience: 'Acme recruiting / warm intro',
        key: audienceKey,
      })
    )
    const second = await runPrivateCryptoPromise(
      encodePrivateAudienceId({
        audience: 'Acme recruiting / warm intro',
        key: audienceKey,
      })
    )
    const decoded = await runPrivateCryptoPromise(
      decodePrivateAudienceId({
        audienceId: first,
        key: audienceKey,
      })
    )

    expect(first).toBe(second)
    expect(first).toHaveLength(59)
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/u)
    expect(looksLikePrivateAudienceId(first)).toBe(true)
    expect(first).not.toContain('Acme')
    expect(decoded).toBe('Acme recruiting / warm intro')
  })

  test('rejects tampered private audience ids', async () => {
    const audienceId = await runPrivateCryptoPromise(
      encodePrivateAudienceId({
        audience: 'PDF QA audience',
        key: audienceKey,
      })
    )
    const payload = await runPrivateCryptoPromise(base64UrlDecode(audienceId))
    payload[payload.byteLength - 1] ^= 1

    expect(audienceId).toHaveLength(42)
    await expect(
      runPrivateCryptoPromise(
        decodePrivateAudienceId({
          audienceId: base64UrlEncode(payload),
          key: audienceKey,
        })
      )
    ).rejects.toThrow('not canonical')
  })

  test('mints v1 compact profile content key capabilities', async () => {
    const token = await runPrivateCryptoPromise(
      mintPrivateCapabilityToken({
        profileContentKey: profileKey,
      })
    )
    const tokenBytes = await runPrivateCryptoPromise(base64UrlDecode(token))
    const capability = await runPrivateCryptoPromise(
      decodePrivateCapabilityToken(token)
    )

    expect(token).toHaveLength(44)
    expect(token).not.toContain('.')
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/u)
    expect(tokenBytes).toHaveLength(33)
    expect(tokenBytes[0]).toBe(PRIVATE_CAPABILITY_TOKEN_VERSION)
    expect(tokenBytes.slice(1)).toEqual(profileKeyBytes)
    expect(capability.profileSelector).toHaveLength(11)
    expect(capability.profileSelector).toMatch(/^[A-Za-z0-9_-]+$/u)
    expect(contentEncryptionKeyBytes(capability.profileContentKey)).toEqual(
      profileKeyBytes
    )
  })

  test('rejects malformed compact capability tokens', async () => {
    await expect(
      runPrivateCryptoPromise(decodePrivateCapabilityToken('!!!!'))
    ).rejects.toThrow()

    await expect(
      runPrivateCryptoPromise(
        decodePrivateCapabilityToken(base64UrlEncode(Uint8Array.of(1, 2, 3)))
      )
    ).rejects.toThrow('33 bytes')
  })

  test('rejects unsupported compact capability token versions', async () => {
    const tokenBytes = new Uint8Array(33)
    tokenBytes[0] = 2
    tokenBytes.set(profileKeyBytes, 1)

    await expect(
      runPrivateCryptoPromise(
        decodePrivateCapabilityToken(base64UrlEncode(tokenBytes))
      )
    ).rejects.toThrow('unsupported version')
  })
})
