import { describe, expect, test } from 'bun:test'
import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Effect } from 'effect'

import {
  asCvPublicationLoadResult,
  type CvPublicResolverBinding,
  loadCvPreview,
  loadCvPublication,
  maximumCvPublicationBytes,
} from './publication'

const validDocument = {
  $schema: 'cv.document.v1',
  locale: 'en',
  direction: 'ltr',
  person: {
    name: 'Ada Lovelace',
    headline: 'Software engineer',
    summary: 'Builds dependable systems with clear reasoning.',
    contacts: [
      {
        kind: 'email',
        label: 'Email',
        value: 'ada@example.test',
        href: 'mailto:ada@example.test',
      },
    ],
  },
  experience: [],
  projects: [],
  skills: [],
  education: [],
  additionalSections: [],
}

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

const responseFor = async (
  document: unknown,
  overrides: Readonly<Record<string, string>> = {}
): Promise<Response> => {
  const bytes = new TextEncoder().encode(JSON.stringify(document))
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/json',
      'x-cv-content-byte-length': bytes.byteLength.toString(10),
      'x-cv-content-sha256': await sha256Hex(bytes),
      'x-cv-contract-id': 'cv.document.v1',
      'x-cv-contract-version': '1',
      'x-cv-document-locale': 'en',
      'x-cv-public-url': 'https://cv.example.test/c/stable-token',
      ...overrides,
    },
  })
}

const bindingFor = (
  response: () => Promise<Response>
): CvPublicResolverBinding => ({ fetch: response })

const runPublication = (effect: ReturnType<typeof loadCvPublication>) =>
  effect.pipe(
    asCvPublicationLoadResult,
    Effect.provide(BrowserCrypto.layer),
    Effect.runPromise
  )

describe('public CV publication loader', () => {
  test('validates and returns a v1 document with its exact public URL', async () => {
    const result = await runPublication(
      loadCvPublication(
        bindingFor(() => responseFor(validDocument)),
        'stable-token'
      )
    )

    expect(result.tag).toBe('success')
    if (result.tag === 'success') {
      expect(result.document.person.name).toBe('Ada Lovelace')
      expect(result.publicUrl).toBe('https://cv.example.test/c/stable-token')
    }
  })

  test('treats missing and disabled links as not found', async () => {
    const result = await runPublication(
      loadCvPublication(
        bindingFor(() => Promise.resolve(new Response(null, { status: 404 }))),
        'disabled-token'
      )
    )

    expect(result).toEqual({ tag: 'not-found' })
  })

  test('rejects content that does not satisfy the document contract', async () => {
    const result = await runPublication(
      loadCvPublication(
        bindingFor(() =>
          responseFor({ ...validDocument, unsupportedRendererField: true })
        ),
        'stable-token'
      )
    )

    expect(result).toEqual({ tag: 'invalid-publication' })
  })

  test('rejects mismatched integrity, locale, contract, and QR URL metadata', async () => {
    const invalidMetadata: ReadonlyArray<Readonly<Record<string, string>>> = [
      { 'x-cv-content-sha256': '0'.repeat(64) },
      { 'x-cv-contract-version': '2' },
      { 'x-cv-document-locale': 'ru' },
      { 'x-cv-public-url': 'https://cv.example.test/c/another-token' },
    ]

    for (const overrides of invalidMetadata) {
      const result = await runPublication(
        loadCvPublication(
          bindingFor(() => responseFor(validDocument, overrides)),
          'stable-token'
        )
      )
      expect(result).toEqual({ tag: 'invalid-publication' })
    }
  })

  test('rejects a declared body above the small publication limit', async () => {
    const result = await runPublication(
      loadCvPublication(
        bindingFor(() =>
          responseFor(validDocument, {
            'x-cv-content-byte-length': (
              maximumCvPublicationBytes + 1
            ).toString(10),
          })
        ),
        'stable-token'
      )
    )

    expect(result).toEqual({ tag: 'invalid-publication' })
  })

  test('reports resolver failures without attempting public HTTP auth', async () => {
    const requestedUrls: string[] = []
    const unavailable = await runPublication(
      loadCvPublication(
        {
          fetch: (request) => {
            requestedUrls.push(request.url)
            return Promise.resolve(new Response(null, { status: 503 }))
          },
        },
        'stable-token'
      )
    )
    const rejected = await runPublication(
      loadCvPublication(
        bindingFor(() => Promise.reject(new Error('resolver unavailable'))),
        'stable-token'
      )
    )

    expect(unavailable).toEqual({ tag: 'unavailable' })
    expect(rejected).toEqual({ tag: 'unavailable' })
    expect(requestedUrls).toEqual([
      'https://registry.internal/cv-publications/stable-token',
    ])
  })

  test('sends preview capabilities only to the private resolver route', async () => {
    const requestedUrls: string[] = []
    const result = await runPublication(
      loadCvPreview(
        {
          fetch: (request) => {
            requestedUrls.push(request.url)
            return responseFor(validDocument)
          },
        },
        'stable-token',
        'preview-secret'
      )
    )

    expect(result.tag).toBe('success')
    expect(requestedUrls).toEqual([
      'https://registry.internal/cv-previews/stable-token?access=preview-secret',
    ])
  })
})
