import { describe, expect, test } from 'bun:test'
import {
  createContentEncryptionKey,
  PrivateCryptoLayer,
  PrivateCryptoUnavailableError,
  runPrivateCryptoPromise,
  WebCryptoApi,
} from '@cv/private-content-crypto'
import type { PrivateRuntimeManifest } from '@cv/private-content-protocol'
import {
  buildPrivateRuntimeManifest,
  emptyPrivateRuntimeManifest,
} from '@cv/private-content-protocol'
import { mintPrivateCapabilityToken } from '@cv/private-content-tokens'
import { Effect, Layer, type Crypto as PlatformCrypto } from 'effect'
import {
  type ContentAccessToken,
  makeContentAccessTokenLayer,
} from './access-token'
import {
  loadContentSession,
  loadContentSessionForToken,
  makeInitialContentSession,
  makeUnavailableContentSession,
} from './session'
import type { ContentCatalog, ContentPageContext } from './types'

const defaultProfileSlug = 'default'

type TestContent = {
  readonly document: {
    readonly labels: Record<string, string>
  }
  readonly identity: {
    readonly role: string
  }
}

const page = {
  locale: 'en',
  profile: defaultProfileSlug,
} satisfies ContentPageContext

const privateProfilePage = {
  ...page,
  audience: 'acme',
} satisfies ContentPageContext

const invalidAudiencePage = {
  ...page,
  audience: 'globex',
} satisfies ContentPageContext

const publicContent: TestContent = {
  document: {
    labels: {
      public: 'Public',
    },
  },
  identity: {
    role: 'Public Role',
  },
}

const catalog = (
  privateManifest: PrivateRuntimeManifest = emptyPrivateRuntimeManifest()
): ContentCatalog<TestContent> => ({
  fileIndex: {
    profiles: {
      p_hiring: ['resume/private.pdf'],
    },
    public: ['resume/public.pdf'],
  },
  loadPrivateRuntimeProfile: async ({ locale, selector }) =>
    privateManifest.profiles.find(
      (profile) => profile.locale === locale && profile.selector === selector
    ) ?? null,
  readContent: () => publicContent,
})

const runSession = <A, E>(
  effect: Effect.Effect<A, E, ContentAccessToken | WebCryptoApi>,
  token: string | null,
  cryptoLayer: Layer.Layer<
    WebCryptoApi | PlatformCrypto.Crypto,
    PrivateCryptoUnavailableError
  > = PrivateCryptoLayer
) =>
  Effect.runPromise(
    effect
      .pipe(Effect.provide(makeContentAccessTokenLayer(token)))
      .pipe(Effect.provide(cryptoLayer))
  )

const privateFixture = async () => {
  const profileContentKeyBytes = Uint8Array.from(
    { length: 32 },
    (_, index) => index + 1
  )
  const profileContentKey = Effect.runSync(
    createContentEncryptionKey(profileContentKeyBytes, 'profile content key')
  )
  const manifest = await runPrivateCryptoPromise(
    buildPrivateRuntimeManifest({
      profiles: [
        {
          content: {
            en: {
              document: {
                labels: {
                  profile: 'Profile',
                },
              },
              identity: {
                role: 'Private Role',
              },
            },
          },
          contentKey: profileContentKey,
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
    })
  )
  const token = await runPrivateCryptoPromise(
    mintPrivateCapabilityToken({
      profileContentKey,
    })
  )

  return { manifest, token }
}

describe('content runtime sessions', () => {
  test('creates an initial loading session for private profile pages', () => {
    const session = makeInitialContentSession({
      catalog: catalog(),
      page: privateProfilePage,
    })

    expect(session.status).toBe('loading')
    expect(session.route).toEqual({
      audienceId: 'acme',
      token: null,
    })
    expect(session.content).toBe(publicContent)
  })

  test('loads public sessions without requiring a token', async () => {
    const session = await runSession(
      loadContentSession({
        catalog: catalog(),
        page,
      }),
      'ignored-token'
    )

    expect(session.status).toBe('public')
    expect(session.route).toBeNull()
    expect(session.private.fileKeys).toBeNull()
  })

  test('marks private profile sessions without a token as invalid', async () => {
    const session = await runSession(
      loadContentSession({
        catalog: catalog(),
        page: privateProfilePage,
      }),
      null
    )

    expect(session.status).toBe('invalid')
    expect(session.route).toEqual({
      audienceId: 'acme',
      token: null,
    })
    expect(session.content).toBe(publicContent)
  })

  test('unlocks private content with a valid token', async () => {
    const { manifest, token } = await privateFixture()
    const session = await runSession(
      loadContentSession({
        catalog: catalog(manifest),
        page: privateProfilePage,
      }),
      token
    )

    expect(session.status).toBe('unlocked')
    expect(session.content.document.labels).toEqual({
      public: 'Public',
      profile: 'Profile',
    })
    expect(session.content.identity.role).toBe('Private Role')
    expect(session.private.variables).toEqual({
      'contact-email': 'private@example.com',
    })
    expect(session.private.fileKeys).not.toBeNull()
    expect(session.route).toEqual({
      audienceId: 'acme',
      profileId: 'p_hiring',
      token,
    })
  })

  test('keeps route audience as analytics context for bearer-token unlocks', async () => {
    const { manifest, token } = await privateFixture()
    const session = await runSession(
      loadContentSession({
        catalog: catalog(manifest),
        page: invalidAudiencePage,
      }),
      token
    )

    expect(session.status).toBe('unlocked')
    expect(session.content.identity.role).toBe('Private Role')
    expect(session.route).toEqual({
      audienceId: 'globex',
      profileId: 'p_hiring',
      token,
    })
  })

  test('loads private runtime profiles by the token selector', async () => {
    const { manifest, token } = await privateFixture()
    const calls: Array<{ locale: string; selector: string }> = []
    const privateCatalog: ContentCatalog<TestContent> = {
      ...catalog(manifest),
      loadPrivateRuntimeProfile: async (options) => {
        calls.push(options)

        return (
          manifest.profiles.find(
            (profile) =>
              profile.locale === options.locale &&
              profile.selector === options.selector
          ) ?? null
        )
      },
    }
    const session = await runSession(
      loadContentSession({
        catalog: privateCatalog,
        page: privateProfilePage,
      }),
      token
    )

    expect(session.status).toBe('unlocked')
    expect(session.content.identity.role).toBe('Private Role')
    expect(session.route).toEqual({
      audienceId: 'acme',
      profileId: 'p_hiring',
      token,
    })
    expect(calls).toEqual([
      {
        locale: 'en',
        selector: manifest.profiles[0]?.selector,
      },
    ])
  })

  test('maps crypto availability failures to unavailable sessions', async () => {
    const { manifest, token } = await privateFixture()
    const privateCatalog = catalog(manifest)
    const unavailableCrypto = Layer.effect(
      WebCryptoApi,
      Effect.fail(
        PrivateCryptoUnavailableError.unavailable(
          'No crypto in this test runtime'
        )
      )
    )
    const session = await Effect.runPromise(
      loadContentSessionForToken({
        catalog: privateCatalog,
        page: privateProfilePage,
        token,
      }).pipe(
        Effect.provide(unavailableCrypto),
        Effect.catchTag('PrivateCryptoUnavailableError', () =>
          Effect.succeed(
            makeUnavailableContentSession({
              catalog: privateCatalog,
              page: privateProfilePage,
              token,
            })
          )
        )
      )
    )

    expect(session.status).toBe('unavailable')
    expect(session.content).toBe(publicContent)
    expect(session.private.fileKeys).toBeNull()
  })

  test('marks tokens for missing private runtime profiles as invalid', async () => {
    const { token } = await privateFixture()
    const session = await runSession(
      loadContentSession({
        catalog: catalog(),
        page: privateProfilePage,
      }),
      token
    )

    expect(session.status).toBe('invalid')
    expect(session.content).toBe(publicContent)
    expect(session.private.fileKeys).toBeNull()
  })
})
