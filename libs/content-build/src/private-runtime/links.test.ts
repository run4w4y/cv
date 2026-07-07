import { describe, expect, test } from 'bun:test'
import {
  base64UrlEncode,
  contentEncryptionKeyBytes,
  deriveProfileContentKey,
  parsePrivateContentRootKey,
  privateContentRootKeyByteLength,
  runPrivateCryptoPromise,
} from '@cv/private-content-crypto'
import { decodePrivateCapabilityToken } from '@cv/private-content-tokens'
import { Effect } from 'effect'
import { mangleProfileId } from '../ids'
import { mintPrivateAudienceLinkFromSecrets } from './links'

const rootKey = `base64url:${base64UrlEncode(
  Uint8Array.from(
    { length: privateContentRootKeyByteLength },
    (_, index) => index + 1
  )
)}`
const audienceKey = 'test-private-audience-key-with-at-least-thirty-two-bytes'

describe('private content links', () => {
  test('mints a private audience link directly from secrets', async () => {
    const link = await runPrivateCryptoPromise(
      mintPrivateAudienceLinkFromSecrets({
        audience: 'Acme',
        audienceKey,
        baseUrl: 'https://cv.example.test',
        contentIdSalt: 'salt',
        locale: 'en',
        profile: 'frontend',
        secrets: {
          rootKey,
        },
      })
    )
    const expectedProfileKey = await runPrivateCryptoPromise(
      parsePrivateContentRootKey(rootKey).pipe(
        Effect.flatMap((parsedRootKey) =>
          deriveProfileContentKey({
            profileId: mangleProfileId('frontend', 'salt'),
            rootKey: parsedRootKey,
          })
        )
      )
    )
    const capability = await runPrivateCryptoPromise(
      decodePrivateCapabilityToken(link.token)
    )

    expect(link.profile).toBe('frontend')
    expect(link.profileId).toBe(mangleProfileId('frontend', 'salt'))
    expect(link.url).toContain('/en/a/')
    expect(link.token).toHaveLength(44)
    expect(link.url).toContain(`?p=${link.token}`)
    expect(contentEncryptionKeyBytes(capability.profileContentKey)).toEqual(
      contentEncryptionKeyBytes(expectedProfileKey)
    )
  })
})
