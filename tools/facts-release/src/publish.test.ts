import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FactsReleaseRegistration } from '@cv/facts-release'
import {
  factsCatalogueFixture,
  fixtureAssetBytes,
  fixtureProvenance,
} from '@cv/facts-release/test-support'
import { Effect, Redacted } from 'effect'

import type { FactsPublisherConfig } from './config'
import type { FactsPublisherFetch } from './http'
import { publishFactsCheckout } from './publish'

const digest = async (bytes: Uint8Array) => {
  const value = await crypto.subtle.digest('SHA-256', bytes.slice())
  return Buffer.from(value).toString('hex')
}

const withCheckout = async <A>(action: (root: string) => Promise<A>) => {
  const root = await mkdtemp(join(tmpdir(), 'cv-facts-publication-'))
  try {
    await mkdir(join(root, 'facts/assets'), { recursive: true })
    await writeFile(
      join(root, 'facts/catalogue.json'),
      JSON.stringify(factsCatalogueFixture(await digest(fixtureAssetBytes)))
    )
    await writeFile(
      join(root, 'facts/assets/asset.employment-review.pdf'),
      fixtureAssetBytes
    )
    return await action(root)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

describe('facts checkout publication', () => {
  test('publishes once with CAS version zero and is idempotent on a rerun', async () => {
    await withCheckout(async (contentRoot) => {
      const config: FactsPublisherConfig = {
        channel: 'production',
        compilerCommit: fixtureProvenance.compiler.commit,
        compilerRepository: fixtureProvenance.compiler.repository,
        contentRoot,
        registryToken: Redacted.make('test-token'),
        registryUrl: new URL('https://registry.example.test'),
        sourceCommit: fixtureProvenance.source.commit,
        sourceRepository: fixtureProvenance.source.repository,
      }
      let activeReleaseId: string | null = null
      let channelVersion = 0
      let registration: FactsReleaseRegistration | null = null
      let registrationPosts = 0
      let activations = 0
      let objectPosts = 0

      const fetchImplementation: FactsPublisherFetch = async (input, init) => {
        const url = new URL(String(input))
        const method = init?.method ?? 'GET'
        expect(new Headers(init?.headers).get('authorization')).toBe(
          'Bearer test-token'
        )

        if (method === 'POST' && url.pathname === '/v1/objects') {
          objectPosts += 1
          const request = JSON.parse(String(init?.body)) as { data: string }
          const bytes = new Uint8Array(Buffer.from(request.data, 'base64'))
          const sha256 = await digest(bytes)
          return Response.json({
            byteLength: bytes.byteLength,
            key: `sha256/${sha256}`,
            sha256,
          })
        }

        if (
          method === 'GET' &&
          url.pathname.startsWith('/v1/facts-releases/fr_')
        ) {
          return registration === null
            ? new Response(null, { status: 404 })
            : Response.json(registration)
        }

        if (method === 'POST' && url.pathname === '/v1/facts-releases') {
          registrationPosts += 1
          registration = JSON.parse(
            String(init?.body)
          ) as FactsReleaseRegistration
          return Response.json(registration)
        }

        if (method === 'GET' && url.pathname === '/v1/facts-releases/active') {
          if (activeReleaseId === null)
            return new Response(null, { status: 404 })
          return Response.json({
            channel: {
              activeReleaseId,
              name: 'production',
              updatedAt: '2026-07-17T12:00:00.000Z',
              version: channelVersion,
            },
          })
        }

        if (
          method === 'PUT' &&
          url.pathname === '/v1/facts-releases/channels/production'
        ) {
          activations += 1
          const request = JSON.parse(String(init?.body)) as {
            expectedVersion: number
            releaseId: string
          }
          expect(request.expectedVersion).toBe(channelVersion)
          activeReleaseId = request.releaseId
          channelVersion += 1
          return Response.json({
            activeReleaseId,
            name: 'production',
            updatedAt: '2026-07-17T12:00:00.000Z',
            version: channelVersion,
          })
        }

        return new Response(null, { status: 500 })
      }

      const first = await Effect.runPromise(
        publishFactsCheckout(config, fetchImplementation)
      )
      const second = await Effect.runPromise(
        publishFactsCheckout(config, fetchImplementation)
      )

      expect(first.status).toBe('activated')
      expect(first.channelVersion).toBe(1)
      expect(second.status).toBe('already-active')
      expect(second.releaseId).toBe(first.releaseId)
      expect(registrationPosts).toBe(1)
      expect(activations).toBe(1)
      expect(objectPosts).toBe(first.objectCount * 2)
    })
  })
})
