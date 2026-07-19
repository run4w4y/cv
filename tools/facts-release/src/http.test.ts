import { describe, expect, test } from 'bun:test'
import {
  compileFactsRelease,
  type FactsReleaseObject,
  FactsReleasePublicationTarget,
  makeFactsReleaseRegistration,
} from '@cv/facts-release'
import {
  factsCatalogueFixture,
  fixtureAssetBytes,
  fixtureProvenance,
} from '@cv/facts-release/test-support'
import { Effect, Redacted } from 'effect'

import type { FactsPublisherConfig } from './config'
import { type FactsPublisherFetch, makeFactsPublisherHttpClient } from './http'

const config: FactsPublisherConfig = {
  channel: 'production',
  compilerCommit: fixtureProvenance.compiler.commit,
  compilerRepository: fixtureProvenance.compiler.repository,
  contentRoot: '/unused',
  registryToken: Redacted.make('test-token'),
  registryUrl: new URL('https://registry.example.test'),
  sourceCommit: fixtureProvenance.source.commit,
  sourceRepository: fixtureProvenance.source.repository,
}

const digest = async (bytes: Uint8Array) => {
  const value = await crypto.subtle.digest('SHA-256', bytes.slice())
  return Buffer.from(value).toString('hex')
}

const response = (body: unknown, status = 200) =>
  Response.json(body, { status })

const objectFixture = async (): Promise<FactsReleaseObject> => {
  const sha256 = await digest(fixtureAssetBytes)
  return {
    byteLength: fixtureAssetBytes.byteLength,
    bytes: fixtureAssetBytes,
    key: `sha256/${sha256}`,
    kind: 'asset',
    logicalId: 'asset.employment-review',
    mediaType: 'application/pdf',
    sha256,
  }
}

describe('facts publisher registry client', () => {
  test('posts exact object bytes and verifies returned content-addressed metadata', async () => {
    const object = await objectFixture()
    const requests: Array<{ init?: RequestInit; url: string }> = []
    const fetchImplementation: FactsPublisherFetch = async (input, init) => {
      requests.push({ init, url: String(input) })
      return response({
        byteLength: object.byteLength,
        key: object.key,
        sha256: object.sha256,
      })
    }
    const client = makeFactsPublisherHttpClient(config, fetchImplementation)

    await Effect.runPromise(
      FactsReleasePublicationTarget.use((target) =>
        target.putObject(object)
      ).pipe(Effect.provide(client.targetLayer))
    )

    expect(requests).toHaveLength(1)
    const request = requests[0]
    expect(request?.url).toBe('https://registry.example.test/v1/objects')
    expect(request?.init?.method).toBe('POST')
    expect(new Headers(request?.init?.headers).get('authorization')).toBe(
      'Bearer test-token'
    )
    const body = JSON.parse(String(request?.init?.body)) as { data: string }
    expect(new Uint8Array(Buffer.from(body.data, 'base64'))).toEqual(
      fixtureAssetBytes
    )
  })

  test('rejects an upload response whose digest does not match the source object', async () => {
    const object = await objectFixture()
    const client = makeFactsPublisherHttpClient(config, async () =>
      response({
        byteLength: object.byteLength,
        key: object.key,
        sha256: '0'.repeat(64),
      })
    )

    const error = await Effect.runPromise(
      Effect.flip(
        FactsReleasePublicationTarget.use((target) =>
          target.putObject(object)
        ).pipe(Effect.provide(client.targetLayer))
      )
    )

    expect(error._tag).toBe('FactsReleasePublicationError')
    expect(error.operation).toBe('upload')
  })

  test('treats a byte-identical existing registration as an idempotent success', async () => {
    const sha256 = await digest(fixtureAssetBytes)
    const bundle = await Effect.runPromise(
      compileFactsRelease({
        assets: [
          {
            bytes: fixtureAssetBytes,
            fileName: 'asset.employment-review.pdf',
            id: 'asset.employment-review',
          },
        ],
        catalogues: [factsCatalogueFixture(sha256)],
        provenance: fixtureProvenance,
      })
    )
    const registration = await Effect.runPromise(
      makeFactsReleaseRegistration(bundle, '2026-07-17T12:00:00.000Z')
    )
    const methods: string[] = []
    const client = makeFactsPublisherHttpClient(
      config,
      async (_input, init) => {
        methods.push(init?.method ?? 'GET')
        return response({
          ...registration,
          release: {
            ...registration.release,
            createdAt: '2026-07-17T11:00:00.000Z',
          },
        })
      }
    )

    await Effect.runPromise(
      FactsReleasePublicationTarget.use((target) =>
        target.register(registration)
      ).pipe(Effect.provide(client.targetLayer))
    )

    expect(methods).toEqual(['GET'])
  })

  test('uses version zero for a missing channel and verifies the CAS activation response', async () => {
    const requests: Array<{ body: unknown; method: string; url: string }> = []
    const client = makeFactsPublisherHttpClient(config, async (input, init) => {
      const url = String(input)
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
        method: init?.method ?? 'GET',
        url,
      })
      if (url.includes('/active?')) return new Response(null, { status: 404 })
      return response({
        activeReleaseId: 'fr_release',
        name: 'production',
        updatedAt: '2026-07-17T12:00:00.000Z',
        version: 1,
      })
    })

    const current = await Effect.runPromise(client.current('ru'))
    const active = await Effect.runPromise(
      client.activate('fr_release', current.version)
    )

    expect(current).toEqual({ activeReleaseId: null, version: 0 })
    expect(active.version).toBe(1)
    expect(requests[1]).toEqual({
      body: { expectedVersion: 0, releaseId: 'fr_release' },
      method: 'PUT',
      url: 'https://registry.example.test/v1/facts-releases/channels/production',
    })
  })
})
