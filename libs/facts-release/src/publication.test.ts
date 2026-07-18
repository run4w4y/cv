import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'

import {
  compileFactsRelease,
  FactsReleaseIntegrityError,
  FactsReleasePublicationError,
  FactsReleasePublicationTarget,
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
      catalogue: factsCatalogueFixture(assetSha256),
      provenance: fixtureProvenance,
    })
  )
}

describe('facts release publication', () => {
  test('uploads every object before registering the release', async () => {
    const bundle = await compiledFixture()
    const memory = makeInMemoryFactsReleasePublication()
    const registration = await Effect.runPromise(
      publishFactsRelease(bundle, '2026-07-17T12:34:56.789Z').pipe(
        Effect.provide(memory.layer)
      )
    )

    expect(memory.objects.size).toBe(bundle.objects.length)
    expect(memory.registrations).toEqual([registration])
    expect(registration.release.id).toBe(bundle.releaseId)
  })

  test('does not register when an object upload fails', async () => {
    const bundle = await compiledFixture()
    let registrations = 0
    const failure = new FactsReleasePublicationError({
      cause: new Error('R2 unavailable'),
      message: 'Could not upload release object.',
      operation: 'upload',
    })
    const layer = Layer.succeed(FactsReleasePublicationTarget, {
      putObject: () => Effect.fail(failure),
      register: () =>
        Effect.sync(() => {
          registrations += 1
        }),
    })

    const error = await Effect.runPromise(
      Effect.flip(
        publishFactsRelease(bundle, '2026-07-17T12:34:56.789Z').pipe(
          Effect.provide(layer)
        )
      )
    )

    expect(error).toBe(failure)
    expect(registrations).toBe(0)
  })

  test('re-verifies addressed bytes before any external write', async () => {
    const bundle = await compiledFixture()
    bundle.manifestObject.bytes.fill(0)
    let writes = 0
    const layer = Layer.succeed(FactsReleasePublicationTarget, {
      putObject: () =>
        Effect.sync(() => {
          writes += 1
        }),
      register: () => Effect.void,
    })

    const error = await Effect.runPromise(
      Effect.flip(
        publishFactsRelease(bundle, '2026-07-17T12:34:56.789Z').pipe(
          Effect.provide(layer)
        )
      )
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
      putObject: () =>
        Effect.sync(() => {
          writes += 1
        }),
      register: () => Effect.void,
    })

    const error = await Effect.runPromise(
      Effect.flip(
        publishFactsRelease(incomplete, '2026-07-17T12:34:56.789Z').pipe(
          Effect.provide(layer)
        )
      )
    )

    expect(error).toBeInstanceOf(FactsReleaseIntegrityError)
    expect(writes).toBe(0)
  })
})
