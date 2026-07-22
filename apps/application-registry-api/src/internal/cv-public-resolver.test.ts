import { describe, expect, test } from 'bun:test'
import {
  RegistryArtifactError,
  RegistryNotFoundError,
} from '@cv/application-registry-service'
import { Effect } from 'effect'

import {
  cvPublicationHeaders,
  makeCvPublicResolverHandler,
  type PublicCvResolution,
  parseCvPreviewResolverToken,
  parseCvPublicationResolverToken,
} from './cv-public-resolver'

const bytes = new TextEncoder().encode('{"arbitrary":"document"}')
const publication: PublicCvResolution = {
  byteLength: bytes.byteLength,
  bytes,
  contractId: 'cv.document.v1',
  contractVersion: '1',
  locale: 'en',
  mediaType: 'application/json',
  publicUrl: 'https://cv.example.test/c/stable-token',
  sha256: 'a'.repeat(64),
}

describe('CV public resolver service-binding handler', () => {
  test('returns exact opaque bytes and publication metadata', async () => {
    const handler = makeCvPublicResolverHandler(() =>
      Effect.succeed(publication)
    )
    const response = await handler(
      new Request('https://registry.internal/cv-publications/stable-token')
    )

    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    expect(response.headers.get(cvPublicationHeaders.contractId)).toBe(
      'cv.document.v1'
    )
    expect(response.headers.get(cvPublicationHeaders.contractVersion)).toBe('1')
    expect(response.headers.get(cvPublicationHeaders.locale)).toBe('en')
    expect(response.headers.get(cvPublicationHeaders.publicUrl)).toBe(
      publication.publicUrl
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  test('maps a missing or disabled publication to not found', async () => {
    const handler = makeCvPublicResolverHandler((token) =>
      Effect.fail(
        new RegistryNotFoundError({
          identifier: token,
          message: `Public CV link not found: ${token}`,
        })
      )
    )
    const response = await handler(
      new Request('https://registry.internal/cv-publications/disabled-token')
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
  })

  test('resolves a private preview only when its capability is present', async () => {
    const calls: Array<readonly [string, string]> = []
    const handler = makeCvPublicResolverHandler(
      () => Effect.die('Public resolution is not expected.'),
      (token, access) => {
        calls.push([token, access])
        return Effect.succeed(publication)
      }
    )
    const missingAccess = await handler(
      new Request('https://registry.internal/cv-previews/stable-token')
    )
    const response = await handler(
      new Request(
        'https://registry.internal/cv-previews/stable-token?access=preview-secret'
      )
    )

    expect(missingAccess.status).toBe(404)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(calls).toEqual([['stable-token', 'preview-secret']])
    expect(parseCvPreviewResolverToken('/cv-previews/bad%2Ftoken')).toBe(null)
  })

  test('does not expose storage failures', async () => {
    const handler = makeCvPublicResolverHandler(() =>
      Effect.fail(
        new RegistryArtifactError({
          cause: 'R2 unavailable',
          message: 'Secret storage detail',
          operation: 'read',
        })
      )
    )
    const response = await handler(
      new Request('https://registry.internal/cv-publications/stable-token')
    )

    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('Secret storage detail')
  })

  test('only accepts GET on the exact internal resolver path', async () => {
    const handler = makeCvPublicResolverHandler(() =>
      Effect.succeed(publication)
    )
    const wrongPath = await handler(
      new Request('https://registry.internal/cv-publications/token/extra')
    )
    const wrongMethod = await handler(
      new Request('https://registry.internal/cv-publications/token', {
        method: 'POST',
      })
    )

    expect(wrongPath.status).toBe(404)
    expect(wrongMethod.status).toBe(405)
    expect(wrongMethod.headers.get('allow')).toBe('GET')
    expect(
      parseCvPublicationResolverToken('/cv-publications/bad%2Ftoken')
    ).toBe(null)
  })
})
