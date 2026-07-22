import { describe, expect, test } from 'bun:test'
import {
  compileFactsCurrentPointerObject,
  compileFactsPublicationObjects,
  compileFactsRelease,
  factsCurrentObjectKey,
  factsReleaseCatalogueObjectKey,
  factsReleaseGenerationGuidanceObjectKey,
  factsReleaseManifestObjectKey,
} from '@cv/facts-release'
import {
  cvGenerationGuidanceFixture,
  factsCatalogueFixture,
  fixtureAssetBytes,
  fixtureProvenance,
} from '@cv/facts-release/test-support'
import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Effect, Layer } from 'effect'

import { FactsObjectNotFoundError } from './errors'
import { FactsObjectStore, type StoredFactsObject } from './object-store'
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
          sha256: assetSha256,
        },
      ],
      catalogues: [
        factsCatalogueFixture(assetSha256),
        factsCatalogueFixture(assetSha256, 'ru'),
      ],
      generationGuidance: cvGenerationGuidanceFixture,
      provenance: fixtureProvenance,
    })
  )
}

const memoryStore = () => {
  const objects = new Map<string, StoredFactsObject>()
  const save = (object: {
    readonly bytes: Uint8Array
    readonly cacheControl: string
    readonly key: string
    readonly mediaType: string
    readonly sha256: string
  }) => {
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
    })
  )
  return { layer, objects, save }
}

const publishFixture = async () => {
  const bundle = await compiledFixture()
  const store = memoryStore()
  for (const object of compileFactsPublicationObjects(bundle)) {
    store.save(object)
  }
  const current = await Effect.runPromise(
    compileFactsCurrentPointerObject(bundle.manifestObject)
  )
  store.save(current.object)
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
  const readActiveRelease = () =>
    Effect.runPromise(
      FactsReader.use((reader) => reader.readActiveRelease()).pipe(
        Effect.provide(readerLayer)
      )
    )
  const readForActiveRelease = (
    activeRelease: Awaited<ReturnType<typeof readActiveRelease>>,
    locale: string
  ) =>
    Effect.runPromise(
      FactsReader.use((reader) =>
        reader.readForActiveRelease(activeRelease, locale)
      ).pipe(Effect.provide(readerLayer))
    )
  const readGenerationGuidance = () =>
    Effect.runPromise(
      FactsReader.use((reader) => reader.readGenerationGuidance()).pipe(
        Effect.provide(readerLayer)
      )
    )
  return {
    bundle,
    read,
    readActiveRelease,
    readForActiveRelease,
    readGenerationGuidance,
    store,
  }
}

describe('private facts reader', () => {
  test('reads verified active release metadata without choosing a locale', async () => {
    const fixture = await publishFixture()

    const activeRelease = await fixture.readActiveRelease()

    expect(activeRelease.releaseId).toBe(fixture.bundle.releaseId)
    expect(activeRelease.locales).toEqual(['en', 'ru'])
    expect(activeRelease.manifest).toEqual(fixture.bundle.manifest)
  })

  test('reads a catalogue from verified release metadata without resolving the pointer again', async () => {
    const fixture = await publishFixture()
    const activeRelease = await fixture.readActiveRelease()
    fixture.store.objects.delete(factsCurrentObjectKey)
    fixture.store.objects.delete(
      factsReleaseManifestObjectKey(activeRelease.releaseId)
    )

    const loaded = await fixture.readForActiveRelease(activeRelease, 'en')

    expect(loaded.releaseId).toBe(activeRelease.releaseId)
    expect(loaded.catalogue.locale).toBe('en')
    expect(loaded.generationGuidance).toEqual(cvGenerationGuidanceFixture)
  })

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
    expect(english.generationGuidance).toEqual(cvGenerationGuidanceFixture)
    expect(english.manifest.catalogues.map(({ locale }) => locale)).toEqual([
      'en',
      'ru',
    ])
  })

  test('reads generation guidance without requiring a catalogue locale', async () => {
    const fixture = await publishFixture()
    fixture.store.objects.delete(
      factsReleaseCatalogueObjectKey(fixture.bundle.releaseId, 'en')
    )
    fixture.store.objects.delete(
      factsReleaseCatalogueObjectKey(fixture.bundle.releaseId, 'ru')
    )

    const loaded = await fixture.readGenerationGuidance()

    expect(loaded.releaseId).toBe(fixture.bundle.releaseId)
    expect(loaded.generationGuidance).toEqual(cvGenerationGuidanceFixture)
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

  test('rejects active release metadata when manifest bytes do not match the pointer', async () => {
    const fixture = await publishFixture()
    const key = factsReleaseManifestObjectKey(fixture.bundle.releaseId)
    const manifest = fixture.store.objects.get(key)
    if (manifest === undefined) throw new Error('Expected release manifest.')
    fixture.store.objects.set(key, {
      ...manifest,
      bytes: new TextEncoder().encode('{}'),
    })

    await expect(fixture.readActiveRelease()).rejects.toMatchObject({
      _tag: 'FactsReaderError',
      key,
      operation: 'verify-manifest',
    })
  })

  test('rejects generation guidance bytes that do not match the manifest digest', async () => {
    const fixture = await publishFixture()
    const key = factsReleaseGenerationGuidanceObjectKey(
      fixture.bundle.releaseId
    )
    const guidance = fixture.store.objects.get(key)
    if (guidance === undefined) throw new Error('Expected generation guidance.')
    fixture.store.objects.set(key, {
      ...guidance,
      bytes: new TextEncoder().encode('{}'),
    })

    await expect(fixture.readGenerationGuidance()).rejects.toMatchObject({
      _tag: 'FactsReaderError',
      key,
      operation: 'verify-generation-guidance',
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
