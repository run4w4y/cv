import { describe, expect, test } from 'bun:test'
import {
  base64UrlEncode,
  contentEncryptionKeyBytes,
  privateContentRootKeyByteLength,
  runPrivateCryptoPromise,
} from '@cv/private-content-crypto'
import { Redacted } from 'effect'
import { runtimeProfilesFromInferredProfiles } from './profiles'

const rootKey = `base64url:${base64UrlEncode(
  Uint8Array.from(
    { length: privateContentRootKeyByteLength },
    (_, index) => index
  )
)}`

describe('private runtime profile input', () => {
  test('derives profile content keys from the private content root key', async () => {
    const profiles = await runPrivateCryptoPromise(
      runtimeProfilesFromInferredProfiles(
        [
          {
            content: { title: 'Frontend CV' },
            id: 'p_frontend',
            locale: 'en',
            profile: 'frontend',
            variableIds: [],
            variables: [],
          },
        ],
        null,
        {
          rootKey: Redacted.make(rootKey),
        }
      )
    )

    expect(profiles[0]?.id).toBe('p_frontend')
    expect(profiles[0]?.contentKey.alg).toBe('PRIVATE-CONTENT-KEY')
    const profile = profiles[0]

    if (!profile) {
      throw new Error('Expected one private runtime profile')
    }

    expect(contentEncryptionKeyBytes(profile.contentKey)).toHaveLength(32)
  })
})
