import { describe, expect, test } from 'bun:test'
import {
  createContentEncryptionKey,
  runPrivateCryptoPromise,
} from '@cv/private-content-crypto'
import { Effect } from 'effect'
import {
  buildPrivateRuntimeManifest,
  decodePrivateRuntimeManifest,
  openRuntimeProfileEntry,
} from './index'

const contentKeyBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1)
const contentKey = Effect.runSync(
  createContentEncryptionKey(contentKeyBytes, 'profile content key')
)

describe('private runtime manifest protocol', () => {
  test('builds, validates, and opens encrypted private profile payloads', async () => {
    const source = {
      profiles: [
        {
          content: {
            en: {
              document: {
                labels: {
                  profile: 'Profile',
                },
              },
            },
          },
          contentKey,
          id: 'p_hiring',
          locale: 'en',
          profile: 'hiring',
          variables: [
            {
              id: 'contact-email',
              value: {
                en: 'private@example.com',
              },
            },
          ],
        },
      ],
    }
    const manifest = await runPrivateCryptoPromise(
      buildPrivateRuntimeManifest(source)
    )
    const decoded = await Effect.runPromise(
      decodePrivateRuntimeManifest(manifest)
    )
    const profile = manifest.profiles[0]

    if (!profile) {
      throw new Error('Expected private runtime profile fixture')
    }

    const opened = await runPrivateCryptoPromise(
      openRuntimeProfileEntry(profile, contentKey)
    )

    expect(decoded).toEqual(manifest)
    expect(manifest.profiles[0]).not.toHaveProperty('publicPath')
    expect(manifest.profiles[0]?.payload.compression).toBe('gzip')
    expect(manifest.profiles[0]?.selector).toHaveLength(11)
    expect(opened).toEqual({
      profile: {
        content: {
          en: {
            document: {
              labels: {
                profile: 'Profile',
              },
            },
          },
        },
        locale: 'en',
        variables: [
          {
            id: 'contact-email',
            value: {
              en: 'private@example.com',
            },
          },
        ],
      },
      profileId: 'p_hiring',
      profileSlug: 'hiring',
    })
  })
})
