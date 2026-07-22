import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import {
  compileFactsCurrentPointerObject,
  compileFactsPublicationObjects,
  compileFactsRelease,
  factsCurrentObjectKey,
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

const compiledFixture = async () => {
  const assetSha256 = await digest(fixtureAssetBytes)
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
      catalogues: [factsCatalogueFixture(assetSha256)],
      generationGuidance: cvGenerationGuidanceFixture,
      provenance: fixtureProvenance,
    })
  )
}

describe('facts release publication objects', () => {
  test('keeps immutable objects separate from the active pointer', async () => {
    const release = await compiledFixture()
    const immutable = compileFactsPublicationObjects(release)
    const current = await Effect.runPromise(
      compileFactsCurrentPointerObject(release.manifestObject)
    )

    expect(immutable).toHaveLength(release.objects.length)
    expect(immutable.map(({ key }) => key)).not.toContain(factsCurrentObjectKey)
    expect(current.object.key).toBe(factsCurrentObjectKey)
    expect(JSON.parse(new TextDecoder().decode(current.object.bytes))).toEqual({
      $schema: 'cv.facts-current.v2',
      manifest: {
        byteLength: release.manifestObject.byteLength,
        mediaType: 'application/vnd.cv.facts-release+json',
        sha256: release.manifestObject.sha256,
      },
      releaseId: release.releaseId,
    })
  })
})
