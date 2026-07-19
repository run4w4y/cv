import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'

import {
  compileFactsRelease,
  FactsReleaseAssetError,
  FactsReleaseManifestV1Schema,
  FactsReleaseValidationError,
  makeFactsReleaseRegistration,
} from './index'
import {
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
      },
    ],
    catalogues: [
      factsCatalogueFixture(assetSha256),
      factsCatalogueFixture(assetSha256, 'ru'),
    ],
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
    expect(first.objects).toHaveLength(4)
    expect(
      first.objects.every((object) => object.key === `sha256/${object.sha256}`)
    ).toBe(true)
    expect(first.manifest.catalogues[0]?.object.mediaType).toBe(
      'application/vnd.cv.facts+json'
    )
    expect(first.manifest.assets[0]?.object.mediaType).toBe('application/pdf')
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

  test('emits a strict decodable release manifest with no self-address', async () => {
    const bundle = await Effect.runPromise(compileFactsRelease(await fixture()))
    const manifestJson = new TextDecoder().decode(bundle.manifestObject.bytes)
    const manifest = Schema.decodeUnknownSync(FactsReleaseManifestV1Schema)(
      JSON.parse(manifestJson)
    )

    expect(manifest.$schema).toBe('cv.facts-release.v1')
    expect(manifest).not.toHaveProperty('releaseId')
    expect(manifest).not.toHaveProperty('createdAt')
    expect(manifest.provenance).toEqual(fixtureProvenance)
    expect(manifest.catalogues.map(({ locale }) => locale)).toEqual([
      'en',
      'ru',
    ])

    const asset = manifest.assets[0]
    if (!asset) {
      throw new Error('Expected the manifest fixture to include one asset.')
    }
    expect(() =>
      Schema.decodeUnknownSync(FactsReleaseManifestV1Schema)({
        ...manifest,
        assets: [asset, asset],
      })
    ).toThrow('Duplicate manifest asset identifier')
    expect(() =>
      Schema.decodeUnknownSync(FactsReleaseManifestV1Schema)({
        ...manifest,
        assets: [
          {
            ...asset,
            object: { ...asset.object, key: `sha256/${'0'.repeat(64)}` },
          },
        ],
      })
    ).toThrow('Object key must contain the declared SHA-256 digest')
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

  test('projects exactly the rows expected by facts release registration', async () => {
    const bundle = await Effect.runPromise(compileFactsRelease(await fixture()))
    const registration = await Effect.runPromise(
      makeFactsReleaseRegistration(bundle, '2026-07-17T12:34:56.789Z')
    )

    expect(registration.release).toEqual({
      compilerCommit: fixtureProvenance.compiler.commit,
      compilerRepository: fixtureProvenance.compiler.repository,
      createdAt: '2026-07-17T12:34:56.789Z',
      factsSchemaVersion: 'cv.facts.v1',
      id: bundle.releaseId,
      manifestByteLength: bundle.manifestObject.byteLength,
      manifestObjectKey: bundle.manifestObject.key,
      manifestSha256: bundle.manifestObject.sha256,
      sourceCommit: fixtureProvenance.source.commit,
      sourceRepository: fixtureProvenance.source.repository,
    })
    expect(registration.catalogs.map(({ locale }) => locale)).toEqual([
      'en',
      'ru',
    ])
    expect(registration.assets[0]?.assetId).toBe('asset.employment-review')
  })

  test('rejects invalid facts through the code-owned facts contract', async () => {
    const input = await fixture()
    const error = await Effect.runPromise(
      Effect.flip(
        compileFactsRelease({
          ...input,
          catalogues: input.catalogues.map((catalogue, index) =>
            index === 0
              ? {
                  ...catalogue,
                  sections: catalogue.sections.map((section) => ({
                    ...section,
                    facts: section.facts.map((fact) => ({
                      ...fact,
                      status: 'draft',
                    })),
                  })),
                }
              : catalogue
          ),
        })
      )
    )

    expect(error).toBeInstanceOf(FactsReleaseValidationError)
    if (error._tag !== 'FactsReleaseValidationError') {
      throw new Error('Expected a facts release validation error.')
    }
    expect(error.context).toBe('catalogue')
  })

  test('requires full immutable source and compiler commit hashes', async () => {
    const input = await fixture()
    const error = await Effect.runPromise(
      Effect.flip(
        compileFactsRelease({
          ...input,
          provenance: {
            ...input.provenance,
            source: { ...input.provenance.source, commit: 'main' },
          },
        })
      )
    )

    expect(error).toBeInstanceOf(FactsReleaseValidationError)
    if (error._tag !== 'FactsReleaseValidationError') {
      throw new Error('Expected a facts release validation error.')
    }
    expect(error.context).toBe('provenance')
  })

  test('requires a canonical UTC publication timestamp', async () => {
    const bundle = await Effect.runPromise(compileFactsRelease(await fixture()))
    const error = await Effect.runPromise(
      Effect.flip(makeFactsReleaseRegistration(bundle, '2026-07-17'))
    )

    expect(error).toBeInstanceOf(FactsReleaseValidationError)
    expect(error.context).toBe('timestamp')
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

  test('rejects unsafe names and bytes that do not match review', async () => {
    const input = await fixture()
    const unsafe = await Effect.runPromise(
      Effect.flip(
        compileFactsRelease({
          ...input,
          assets: input.assets.map((asset) => ({
            ...asset,
            fileName: '../review.pdf',
          })),
        })
      )
    )
    const mismatch = await Effect.runPromise(
      Effect.flip(
        compileFactsRelease({
          ...input,
          assets: input.assets.map((asset) => ({
            ...asset,
            bytes: new TextEncoder().encode('not reviewed'),
          })),
        })
      )
    )

    if (unsafe._tag !== 'FactsReleaseAssetError') {
      throw new Error('Expected an unsafe facts asset error.')
    }
    if (mismatch._tag !== 'FactsReleaseAssetError') {
      throw new Error('Expected a facts asset digest error.')
    }
    expect(unsafe.issue).toBe('invalid-file-name')
    expect(mismatch.issue).toBe('digest-mismatch')
    expect(mismatch.expected).toBe(input.catalogues[0]?.assets[0]?.sha256)
    expect(mismatch.actual).toHaveLength(64)
  })
})
