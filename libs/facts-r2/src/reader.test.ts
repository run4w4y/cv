import { describe, expect, test } from 'bun:test'
import {
  compileFactsRelease,
  factsReleaseCatalogueObjectKey,
  publishFactsRelease,
} from '@cv/facts-release'
import {
  factsCatalogueFixture,
  fixtureAssetBytes,
  fixtureProvenance,
} from '@cv/facts-release/test-support'
import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Effect, Layer } from 'effect'

import { FactsObjectNotFoundError } from './errors'
import {
  FactsObjectStore,
  type StoredFactsObject,
  type WritableFactsObject,
} from './object-store'
import { factsR2PublicationTargetLayer } from './publication'
import { FactsReader, factsReaderLayer } from './reader'

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const result = await crypto.subtle.digest('SHA-256', bytes.slice())
  return Array.from(new Uint8Array(result), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

const compiledFixture = async () => {
  const assetSha256 = await sha256(fixtureAssetBytes)
  return Effect.runPromise(
    compileFactsRelease({
      assets: [
        {
          bytes: fixtureAssetBytes,
          fileName: 'employment-review.pdf',
          id: 'asset.employment-review',
        },
      ],
      catalogues: [
        factsCatalogueFixture(assetSha256),
        factsCatalogueFixture(assetSha256, 'ru'),
      ],
      provenance: fixtureProvenance,
    })
  )
}

const memoryStore = () => {
  const objects = new Map<string, StoredFactsObject>()
  const save = (object: WritableFactsObject) => {
    objects.set(object.key, {
      bytes: object.bytes.slice(),
      cacheControl: object.cacheControl,
      etag: `"${object.sha256}"`,
      mediaType: object.mediaType,
      sha256: object.sha256,
    })
  }
  const layer = Layer.succeed(
    FactsObjectStore,
    FactsObjectStore.of({
      get: (key) => {
        const object = objects.get(key)
        return object === undefined
          ? Effect.fail(
              new FactsObjectNotFoundError({
                key,
                message: `Missing test object ${key}.`,
              })
            )
          : Effect.succeed({ ...object, bytes: object.bytes.slice() })
      },
      putCurrent: (object) =>
        Effect.sync(() => {
          save(object)
          return 'activated' as const
        }),
      putImmutable: (object) => Effect.sync(() => save(object)),
    })
  )
  return { layer, objects }
}

const publishFixture = async () => {
  const bundle = await compiledFixture()
  const store = memoryStore()
  await Effect.runPromise(
    publishFactsRelease(bundle).pipe(
      Effect.provide(factsR2PublicationTargetLayer),
      Effect.provide(store.layer)
    )
  )
  const readerLayer = factsReaderLayer.pipe(
    Layer.provide(store.layer),
    Layer.provide(BrowserCrypto.layer)
  )
  const read = (locale: string) =>
    Effect.runPromise(
      FactsReader.use((reader) => reader.read(locale)).pipe(
        Effect.provide(readerLayer)
      )
    )
  return { bundle, read, store }
}

describe('private facts reader', () => {
  test('resolves the current release and validates both configured locales', async () => {
    const fixture = await publishFixture()
    const [english, russian] = await Promise.all([
      fixture.read('en'),
      fixture.read('ru'),
    ])

    expect(english.releaseId).toBe(fixture.bundle.releaseId)
    expect(english.catalogue.locale).toBe('en')
    expect(russian.releaseId).toBe(fixture.bundle.releaseId)
    expect(russian.catalogue.locale).toBe('ru')
    expect(english.manifest.catalogues.map(({ locale }) => locale)).toEqual([
      'en',
      'ru',
    ])
  })

  test('rejects catalogue bytes that do not match the manifest digest', async () => {
    const fixture = await publishFixture()
    const key = factsReleaseCatalogueObjectKey(fixture.bundle.releaseId, 'en')
    const catalogue = fixture.store.objects.get(key)
    if (catalogue === undefined) throw new Error('Expected English catalogue.')
    fixture.store.objects.set(key, {
      ...catalogue,
      bytes: new TextEncoder().encode('{}'),
    })

    await expect(fixture.read('en')).rejects.toMatchObject({
      _tag: 'FactsReaderError',
      key,
      operation: 'verify-catalogue',
    })
  })

  test('rejects locales absent from the published manifest', async () => {
    const fixture = await publishFixture()

    await expect(fixture.read('de')).rejects.toMatchObject({
      _tag: 'FactsReaderError',
      operation: 'read-catalogue',
    })
  })
})
