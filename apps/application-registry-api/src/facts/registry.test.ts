import { describe, expect, test } from 'bun:test'
import {
  compileFactsRelease,
  compileFactsReleaseBundle,
  encodeFactsReleaseBundle,
  factsCurrentObjectKey,
} from '@cv/facts-release'
import {
  cvGenerationGuidanceFixture,
  factsCatalogueFixture,
  fixtureAssetBytes,
  fixtureProvenance,
} from '@cv/facts-release/test-support'
import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Effect, Layer } from 'effect'

import {
  FactsRegistry,
  FactsRegistryLive,
  type FactsRegistryShape,
} from './registry'
import {
  FactsStorage,
  type FactsStorageMetadata,
  type FactsStorageObject,
  type FactsStoragePutInput,
} from './storage'

const sha256 = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice())
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

const releaseBundle = async () => {
  const assetSha256 = await sha256(fixtureAssetBytes)
  const release = await Effect.runPromise(
    compileFactsRelease({
      assets: [
        {
          bytes: fixtureAssetBytes,
          fileName: 'employment-review.pdf',
          id: 'asset.employment-review',
          sha256: assetSha256,
        },
      ],
      catalogues: [factsCatalogueFixture(assetSha256)],
      generationGuidance: cvGenerationGuidanceFixture,
      provenance: fixtureProvenance,
    })
  )
  const bundle = compileFactsReleaseBundle(release)
  const bytes = await Effect.runPromise(
    encodeFactsReleaseBundle(bundle).pipe(Effect.provide(BrowserCrypto.layer))
  )
  return { bundle, bytes }
}

const memoryStorage = () => {
  const objects = new Map<string, FactsStorageObject>()
  let revision = 0
  const metadata = (object: FactsStorageObject): FactsStorageMetadata => ({
    cacheControl: object.cacheControl,
    etag: object.etag,
    mediaType: object.mediaType,
    responseEtag: object.responseEtag,
    sha256: object.sha256,
    size: object.size,
  })
  const put = (input: FactsStoragePutInput) =>
    Effect.sync(() => {
      const existing = objects.get(input.key)
      const matches =
        input.condition._tag === 'Create'
          ? existing === undefined
          : existing?.etag === input.condition.etag
      if (!matches) return false
      const etag = `${++revision}`
      objects.set(input.key, {
        bytes: input.bytes.slice(),
        cacheControl: input.cacheControl,
        etag,
        mediaType: input.mediaType,
        responseEtag: `"${etag}"`,
        sha256: input.sha256,
        size: input.bytes.byteLength,
      })
      return true
    })
  const get = (key: string) => {
    const object = objects.get(key)
    return object === undefined
      ? null
      : { ...object, bytes: object.bytes.slice() }
  }
  const head = (key: string) => {
    const object = objects.get(key)
    return object === undefined ? null : metadata(object)
  }
  const layer = Layer.succeed(
    FactsStorage,
    FactsStorage.of({
      get: (key) => Effect.succeed(get(key)),
      head: (key) => Effect.succeed(head(key)),
      put,
    })
  )
  return { layer, objects }
}

const withRegistry = <A>(
  storage: ReturnType<typeof memoryStorage>,
  use: (registry: FactsRegistryShape) => Effect.Effect<A, unknown>
) =>
  FactsRegistry.pipe(Effect.flatMap(use)).pipe(
    Effect.provide(FactsRegistryLive),
    Effect.provide(storage.layer),
    Effect.provide(BrowserCrypto.layer)
  )

describe('facts registry', () => {
  test('registers immutable objects idempotently and activates with compare-and-set', async () => {
    const source = await releaseBundle()
    const storage = memoryStorage()

    const result = await Effect.runPromise(
      withRegistry(storage, (registry) =>
        Effect.gen(function* () {
          const first = yield* registry.register(
            source.bundle.releaseId,
            source.bytes
          )
          const second = yield* registry.register(
            source.bundle.releaseId,
            source.bytes
          )
          const activated = yield* registry.activate({
            expectedCurrentReleaseId: null,
            releaseId: source.bundle.releaseId,
          })
          const repeated = yield* registry.activate({
            expectedCurrentReleaseId: null,
            releaseId: source.bundle.releaseId,
          })
          const current = yield* registry.current()
          return { activated, current, first, repeated, second }
        })
      )
    )

    expect(result.first.status).toBe('registered')
    expect(result.second.status).toBe('already-registered')
    expect(result.activated.status).toBe('activated')
    expect(result.repeated.status).toBe('already-active')
    expect(result.current?.releaseId).toBe(source.bundle.releaseId)
    expect(storage.objects.has(factsCurrentObjectKey)).toBe(true)
  })

  test('rejects activation when the expected active release is stale', async () => {
    const source = await releaseBundle()
    const storage = memoryStorage()

    const error = await Effect.runPromise(
      withRegistry(storage, (registry) =>
        registry.register(source.bundle.releaseId, source.bytes).pipe(
          Effect.andThen(
            registry.activate({
              expectedCurrentReleaseId: `fr_${'f'.repeat(64)}`,
              releaseId: source.bundle.releaseId,
            })
          ),
          Effect.flip
        )
      )
    )

    expect(error).toMatchObject({
      _tag: 'FactsRegistryError',
      issue: 'conflict',
    })
    expect(storage.objects.has(factsCurrentObjectKey)).toBe(false)
  })
})
