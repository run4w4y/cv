import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import {
  asCvPublicationLoadResult,
  type CvPublicResolverBinding,
  loadCvPreview,
  loadCvPublication,
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

const responseFor = (
  document: unknown,
  overrides: Readonly<Record<string, string>> = {}
): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify(document), {
      headers: {
        'x-cv-public-url': 'https://cv.example.test/c/stable-token',
        ...overrides,
      },
    })
  )

const bindingFor = (
  response: () => Promise<Response>
): CvPublicResolverBinding => ({ fetch: response })

const runPublication = (effect: ReturnType<typeof loadCvPublication>) =>
  effect.pipe(asCvPublicationLoadResult, Effect.runPromise)

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

  test('rejects a body that is not valid JSON', async () => {
    const result = await runPublication(
      loadCvPublication(
        bindingFor(() =>
          Promise.resolve(
            new Response('not-json', {
              headers: {
                'x-cv-public-url': 'https://cv.example.test/c/stable-token',
              },
            })
          )
        ),
        'stable-token'
      )
    )

    expect(result).toEqual({ tag: 'invalid-publication' })
  })

  test('trusts the public URL supplied by the internal resolver', async () => {
    const result = await runPublication(
      loadCvPublication(
        bindingFor(() =>
          responseFor(validDocument, {
            'x-cv-public-url': 'internal-resolver-value',
          })
        ),
        'stable-token'
      )
    )

    expect(result).toMatchObject({
      publicUrl: 'internal-resolver-value',
      tag: 'success',
    })
  })

  test('rejects a resolver response without its required public URL', async () => {
    const result = await runPublication(
      loadCvPublication(
        bindingFor(() =>
          Promise.resolve(new Response(JSON.stringify(validDocument)))
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
