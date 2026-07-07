import { describe, expect, test } from 'bun:test'
import {
  bytesToUtf8,
  createContentEncryptionKey,
  encryptPrivateFilePayload,
  PrivateCryptoLayer,
  utf8ToBytes,
} from '@cv/private-content-crypto'
import { runtimeProfileFileAad } from '@cv/private-content-protocol'
import { Effect, Layer } from 'effect'
import {
  decodeContentFileIndex,
  normalizeContentFileHref,
  openContentFile,
  publicContentFileHref,
  resolveContentFile,
  resolveContentFileHref,
} from './files'
import {
  PrivateContentFileIO,
  type PrivateContentFileIOService,
} from './private-file-io'
import type { ContentSession } from './types'

const profileContentKey = Effect.runSync(
  createContentEncryptionKey(
    Uint8Array.from({ length: 32 }, (_, index) => index + 1)
  )
)

const unlockedSession = {
  content: {},
  files: {
    profiles: {
      p_hiring: ['resume/private.pdf'],
    },
    public: ['resume/public.pdf'],
  },
  page: {
    audience: 'acme',
    locale: 'en',
    profile: 'hiring',
    profileId: 'p_hiring',
  },
  private: {
    fileKeys: {
      profileContentKey,
    },
    variables: {},
  },
  route: {
    audienceId: 'acme',
    profileId: 'p_hiring',
    token: 'token',
  },
  status: 'unlocked',
} satisfies ContentSession

describe('content runtime files', () => {
  test('decodes file indexes defensively', () => {
    expect(
      decodeContentFileIndex({
        profiles: {
          hiring: ['resume/private.pdf'],
          invalid: ['ok.pdf', 7],
        },
        public: ['resume/public.pdf'],
      })
    ).toEqual({
      profiles: {
        hiring: ['resume/private.pdf'],
      },
      public: ['resume/public.pdf'],
    })

    expect(decodeContentFileIndex(null)).toEqual({
      profiles: {},
      public: [],
    })
  })

  test('normalizes relative public file hrefs', () => {
    expect(normalizeContentFileHref('./docs/cv.pdf')).toBe('docs/cv.pdf')
    expect(normalizeContentFileHref('docs/../secret.pdf')).toBeNull()
    expect(normalizeContentFileHref('https://example.com/cv.pdf')).toBeNull()
    expect(publicContentFileHref('docs/My CV.pdf')).toBe(
      '/files/docs/My%20CV.pdf'
    )
  })

  test('resolves public, private, unknown, and external file hrefs', () => {
    const index = {
      profiles: {
        hiring: ['resume/private.pdf', 'resume/shared-name.pdf'],
      },
      public: ['resume/public.pdf', 'resume/shared-name.pdf'],
    }

    expect(
      resolveContentFileHref({
        href: 'https://example.com/resume.pdf',
        index,
      })
    ).toEqual({
      href: 'https://example.com/resume.pdf',
      kind: 'external',
    })
    expect(
      resolveContentFileHref({
        href: 'resume/missing.pdf',
        index: null,
      })
    ).toEqual({
      href: '/files/resume/missing.pdf',
      kind: 'unknown',
      relativePath: 'resume/missing.pdf',
    })
    expect(
      resolveContentFileHref({
        href: 'resume/shared-name.pdf',
        index,
        privateMode: false,
        profile: 'hiring',
      })
    ).toEqual({
      href: '/files/resume/shared-name.pdf',
      kind: 'public',
      relativePath: 'resume/shared-name.pdf',
    })
    expect(
      resolveContentFileHref({
        href: 'resume/private.pdf',
        index,
        privateMode: true,
        profile: 'hiring',
      })
    ).toEqual({
      encryptedHref: '/_content/files/hiring/resume/private.pdf',
      href: '/files/resume/private.pdf',
      kind: 'private',
      profile: 'hiring',
      relativePath: 'resume/private.pdf',
      scope: 'profile',
    })
    expect(
      resolveContentFileHref({
        href: 'portfolio/private.pdf',
        index,
        privateMode: true,
      })
    ).toEqual({
      href: '/files/portfolio/private.pdf',
      kind: 'missing',
      relativePath: 'portfolio/private.pdf',
    })
  })

  test('resolves private files from the active profile route', () => {
    expect(resolveContentFile(unlockedSession, 'resume/private.pdf')).toEqual({
      encryptedHref: '/_content/files/p_hiring/resume/private.pdf',
      href: '/files/resume/private.pdf',
      kind: 'private',
      profile: 'p_hiring',
      relativePath: 'resume/private.pdf',
      scope: 'profile',
    })
  })

  test('resolves private files from the public page profile id', () => {
    const publicSession = {
      ...unlockedSession,
      private: {
        fileKeys: null,
        variables: {},
      },
      route: null,
      status: 'public',
    } satisfies ContentSession

    expect(resolveContentFile(publicSession, 'resume/private.pdf')).toEqual({
      encryptedHref: '/_content/files/p_hiring/resume/private.pdf',
      href: '/files/resume/private.pdf',
      kind: 'private',
      profile: 'p_hiring',
      relativePath: 'resume/private.pdf',
      scope: 'profile',
    })
  })

  test('does not touch file IO when the file is not private and unlocked', async () => {
    const calls: string[] = []
    const fileIO: PrivateContentFileIOService = {
      fetchBytes: (href: string) => {
        calls.push(`fetch:${href}`)
        return Effect.succeed(new Uint8Array())
      },
      saveBytes: (_bytes, filename: string) =>
        Effect.sync(() => {
          calls.push(`save:${filename}`)
        }),
    }
    const fileIOLayer = Layer.succeed(PrivateContentFileIO, fileIO)

    await Effect.runPromise(
      openContentFile(unlockedSession, 'resume/public.pdf').pipe(
        Effect.provide(fileIOLayer),
        Effect.provide(PrivateCryptoLayer)
      )
    )

    expect(calls).toEqual([])
  })

  test('fetches, decrypts, and saves private files through the file IO service', async () => {
    const encrypted = await Effect.runPromise(
      encryptPrivateFilePayload(
        profileContentKey,
        utf8ToBytes('private file'),
        runtimeProfileFileAad('p_hiring', 'resume/private.pdf')
      ).pipe(Effect.provide(PrivateCryptoLayer))
    )
    const calls: string[] = []
    const fileIO: PrivateContentFileIOService = {
      fetchBytes: (href: string) => {
        calls.push(`fetch:${href}`)
        return Effect.succeed(encrypted)
      },
      saveBytes: (plaintext, filename: string) =>
        Effect.sync(() => {
          calls.push(`save:${filename}:${bytesToUtf8(plaintext)}`)
        }),
    }
    const fileIOLayer = Layer.succeed(PrivateContentFileIO, fileIO)

    await Effect.runPromise(
      openContentFile(unlockedSession, 'resume/private.pdf').pipe(
        Effect.provide(fileIOLayer),
        Effect.provide(PrivateCryptoLayer)
      )
    )

    expect(calls).toEqual([
      'fetch:/_content/files/p_hiring/resume/private.pdf',
      'save:private.pdf:private file',
    ])
  })
})
