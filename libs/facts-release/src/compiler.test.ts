import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'

import {
  compileFactsRelease,
  FactsReleaseAssetError,
  FactsReleaseManifestV2Schema,
} from './index'
import {
  cvGenerationGuidanceFixture,
  factsCatalogueFixture,
  fixtureAssetBytes,
  fixtureProvenance,
} from './test-support'

const digest = async (bytes: Uint8Array) => {
  const result = await crypto.subtle.digest('SHA-256', bytes.slice())
  return [...new Uint8Array(result)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const fixture = async () => {
  const assetSha256 = await digest(fixtureAssetBytes)
  return {
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
  }
}

describe('facts release compiler', () => {
  test('builds deterministic content-addressed catalogue, asset, and manifest objects', async () => {
    const input = await fixture()
    const first = await Effect.runPromise(compileFactsRelease(input))
    const second = await Effect.runPromise(compileFactsRelease(input))

    expect(second.releaseId).toBe(first.releaseId)
    expect(second.manifestObject.bytes).toEqual(first.manifestObject.bytes)
    expect(first.releaseId).toBe(`fr_${first.manifestObject.sha256}`)
    expect(first.objects).toHaveLength(5)
    expect(
      first.objects.every((object) => object.key === `sha256/${object.sha256}`)
    ).toBe(true)
    expect(first.manifest.catalogues[0]?.object.mediaType).toBe(
      'application/vnd.cv.facts+json'
    )
    expect(first.manifest.assets[0]?.object.mediaType).toBe('application/pdf')
    expect(first.manifest.generationGuidance).toMatchObject({
      contract: 'cv.generation-guidance.v1',
      documentContract: 'cv.document.v1',
    })
  })

  test('canonicalizes configured locale order', async () => {
    const input = await fixture()
    const first = await Effect.runPromise(
      compileFactsRelease({
        ...input,
        catalogues: [...input.catalogues].reverse(),
      })
    )
    const second = await Effect.runPromise(compileFactsRelease(input))

    expect(first.releaseId).toBe(second.releaseId)
    expect(first.catalogues.map(({ locale }) => locale)).toEqual(['en', 'ru'])
  })

  test('emits a strict decodable release manifest without storage addresses', async () => {
    const bundle = await Effect.runPromise(compileFactsRelease(await fixture()))
    const manifestJson = new TextDecoder().decode(bundle.manifestObject.bytes)
    const manifest = Schema.decodeUnknownSync(FactsReleaseManifestV2Schema)(
      JSON.parse(manifestJson)
    )

    expect(manifest.$schema).toBe('cv.facts-release.v2')
    expect(manifest).not.toHaveProperty('releaseId')
    expect(manifest).not.toHaveProperty('createdAt')
    expect(manifest.provenance).toEqual(fixtureProvenance)
    expect(manifest.catalogues.map(({ locale }) => locale)).toEqual([
      'en',
      'ru',
    ])
    const { generationGuidance: _, ...incompleteManifest } = manifest
    expect(() =>
      Schema.decodeUnknownSync(FactsReleaseManifestV2Schema)(incompleteManifest)
    ).toThrow()

    const asset = manifest.assets[0]
    if (!asset) {
      throw new Error('Expected the manifest fixture to include one asset.')
    }
    expect(() =>
      Schema.decodeUnknownSync(FactsReleaseManifestV2Schema)({
        ...manifest,
        assets: [asset, asset],
      })
    ).toThrow('Duplicate manifest asset identifier')
    expect(asset.object).not.toHaveProperty('key')
    expect(() =>
      Schema.decodeUnknownSync(FactsReleaseManifestV2Schema)({
        ...manifest,
        assets: [
          {
            ...asset,
            object: { ...asset.object, key: `sha256/${'0'.repeat(64)}` },
          },
        ],
      })
    ).toThrow()
  })

  test('copies source bytes before returning the bundle', async () => {
    const input = await fixture()
    const expected = fixtureAssetBytes.slice()
    const bundle = await Effect.runPromise(compileFactsRelease(input))
    input.assets[0]?.bytes.fill(0)
    const asset = bundle.objects.find((object) => object.kind === 'asset')

    expect(asset?.bytes).toEqual(expected)
  })

  test('supports catalogues without assets', async () => {
    const input = await fixture()
    const bundle = await Effect.runPromise(
      compileFactsRelease({
        ...input,
        assets: [],
        catalogues: input.catalogues.map((catalogue) => ({
          ...catalogue,
          assets: [],
        })),
      })
    )

    expect(bundle.manifest.assets).toEqual([])
    expect(bundle.objects.map((object) => object.kind)).toEqual([
      'catalogue',
      'catalogue',
      'generation-guidance',
      'manifest',
    ])
  })

  test('uploads identical asset bytes only once while retaining both IDs', async () => {
    const input = await fixture()
    const original = input.catalogues[0]?.assets[0]
    const originalSource = input.assets[0]
    if (!original || !originalSource) {
      throw new Error('Expected the facts fixture to include one asset.')
    }
    const bundle = await Effect.runPromise(
      compileFactsRelease({
        ...input,
        assets: [
          ...input.assets,
          {
            ...originalSource,
            fileName: 'employment-review-copy.pdf',
            id: 'asset.employment-review-copy',
          },
        ],
        catalogues: input.catalogues.map((catalogue) => ({
          ...catalogue,
          assets: [
            original,
            { ...original, id: 'asset.employment-review-copy' },
          ],
        })),
      })
    )

    expect(bundle.manifest.assets).toHaveLength(2)
    expect(
      bundle.objects.filter((object) => object.kind === 'asset')
    ).toHaveLength(1)
  })
})

describe('facts release asset validation', () => {
  test('rejects missing asset sources', async () => {
    const input = await fixture()
    const error = await Effect.runPromise(
      Effect.flip(compileFactsRelease({ ...input, assets: [] }))
    )

    expect(error).toBeInstanceOf(FactsReleaseAssetError)
    if (error._tag !== 'FactsReleaseAssetError') {
      throw new Error('Expected a facts release asset error.')
    }
    expect(error.issue).toBe('missing-source')
  })

  test('rejects extra and duplicate asset sources', async () => {
    const input = await fixture()
    const extra = await Effect.runPromise(
      Effect.flip(
        compileFactsRelease({
          ...input,
          assets: [
            ...input.assets,
            {
              bytes: new Uint8Array(),
              fileName: 'extra.txt',
              id: 'asset.extra',
              sha256: '0'.repeat(64),
            },
          ],
        })
      )
    )
    const duplicate = await Effect.runPromise(
      Effect.flip(
        compileFactsRelease({
          ...input,
          assets: [...input.assets, ...input.assets],
        })
      )
    )

    if (extra._tag !== 'FactsReleaseAssetError') {
      throw new Error('Expected an extra facts asset error.')
    }
    if (duplicate._tag !== 'FactsReleaseAssetError') {
      throw new Error('Expected a duplicate facts asset error.')
    }
    expect(extra.issue).toBe('unexpected-source')
    expect(duplicate.issue).toBe('duplicate-source')
  })

  test('rejects inconsistent precomputed asset digests', async () => {
    const input = await fixture()
    const mismatch = await Effect.runPromise(
      Effect.flip(
        compileFactsRelease({
          ...input,
          assets: input.assets.map((asset) => ({
            ...asset,
            sha256: '0'.repeat(64),
          })),
        })
      )
    )

    if (mismatch._tag !== 'FactsReleaseAssetError') {
      throw new Error('Expected a facts asset digest error.')
    }
    expect(mismatch.issue).toBe('digest-mismatch')
    expect(mismatch.expected).toBe(input.catalogues[0]?.assets[0]?.sha256)
    expect(mismatch.actual).toHaveLength(64)
  })

  test('rejects different media types for one content-addressed asset', async () => {
    const input = await fixture()
    const original = input.catalogues[0]?.assets[0]
    const originalSource = input.assets[0]
    if (!original || !originalSource) {
      throw new Error('Expected the facts fixture to include one asset.')
    }
    const error = await Effect.runPromise(
      Effect.flip(
        compileFactsRelease({
          ...input,
          assets: [
            ...input.assets,
            {
              ...originalSource,
              fileName: 'employment-review.txt',
              id: 'asset.employment-review-text',
            },
          ],
          catalogues: input.catalogues.map((catalogue) => ({
            ...catalogue,
            assets: [
              original,
              {
                ...original,
                id: 'asset.employment-review-text',
                mediaType: 'text/plain',
              },
            ],
          })),
        })
      )
    )

    if (error._tag !== 'FactsReleaseAssetError') {
      throw new Error('Expected a facts release asset error.')
    }
    expect(error.issue).toBe('media-type-conflict')
    expect(error.expected).toBe('application/pdf')
    expect(error.actual).toBe('text/plain')
  })
})
