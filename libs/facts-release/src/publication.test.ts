import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'

import {
  compileFactsRelease,
  FactsReleaseIntegrityError,
  FactsReleasePublicationError,
  FactsReleasePublicationTarget,
  factsCurrentObjectKey,
  publishFactsRelease,
} from './index'
import {
  factsCatalogueFixture,
  fixtureAssetBytes,
  fixtureProvenance,
  makeInMemoryFactsReleasePublication,
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
        },
      ],
      catalogues: [factsCatalogueFixture(assetSha256)],
      provenance: fixtureProvenance,
    })
  )
}

describe('facts release publication', () => {
  test('uploads immutable objects before activating the deterministic pointer', async () => {
    const bundle = await compiledFixture()
    const memory = makeInMemoryFactsReleasePublication()
    const publication = await Effect.runPromise(
      publishFactsRelease(bundle).pipe(Effect.provide(memory.layer))
    )

    expect(memory.objects.size).toBe(bundle.objects.length + 1)
    expect(memory.writes.at(-1)).toBe(factsCurrentObjectKey)
    expect(publication.releaseId).toBe(bundle.releaseId)
    expect(publication.status).toBe('activated')
    expect(publication.pointer).toEqual({
      $schema: 'cv.facts-current.v1',
      manifest: {
        byteLength: bundle.manifestObject.byteLength,
        mediaType: 'application/vnd.cv.facts-release+json',
        sha256: bundle.manifestObject.sha256,
      },
      releaseId: bundle.releaseId,
    })

    const repeated = await Effect.runPromise(
      publishFactsRelease(bundle).pipe(Effect.provide(memory.layer))
    )
    expect(repeated.status).toBe('already-active')
  })

  test('does not activate current.json when an immutable upload fails', async () => {
    const bundle = await compiledFixture()
    let activations = 0
    const failure = new FactsReleasePublicationError({
      cause: new Error('R2 unavailable'),
      message: 'Could not upload release object.',
      operation: 'upload',
    })
    const layer = Layer.succeed(FactsReleasePublicationTarget, {
      putCurrent: () =>
        Effect.sync(() => {
          activations += 1
          return 'activated' as const
        }),
      putImmutable: () => Effect.fail(failure),
    })

    const error = await Effect.runPromise(
      Effect.flip(publishFactsRelease(bundle).pipe(Effect.provide(layer)))
    )

    expect(error).toBe(failure)
    expect(activations).toBe(0)
  })

  test('re-verifies addressed bytes before any external write', async () => {
    const bundle = await compiledFixture()
    bundle.manifestObject.bytes.fill(0)
    let writes = 0
    const layer = Layer.succeed(FactsReleasePublicationTarget, {
      putCurrent: () => Effect.succeed('activated' as const),
      putImmutable: () =>
        Effect.sync(() => {
          writes += 1
        }),
    })

    const error = await Effect.runPromise(
      Effect.flip(publishFactsRelease(bundle).pipe(Effect.provide(layer)))
    )

    expect(error).toBeInstanceOf(FactsReleaseIntegrityError)
    expect(writes).toBe(0)
  })

  test('rejects a bundle missing a manifest-referenced object', async () => {
    const bundle = await compiledFixture()
    const incomplete = {
      ...bundle,
      objects: bundle.objects.filter((object) => object.kind !== 'asset'),
    }
    let writes = 0
    const layer = Layer.succeed(FactsReleasePublicationTarget, {
      putCurrent: () => Effect.succeed('activated' as const),
      putImmutable: () =>
        Effect.sync(() => {
          writes += 1
        }),
    })

    const error = await Effect.runPromise(
      Effect.flip(publishFactsRelease(incomplete).pipe(Effect.provide(layer)))
    )

    expect(error).toBeInstanceOf(FactsReleaseIntegrityError)
    expect(writes).toBe(0)
  })
})
