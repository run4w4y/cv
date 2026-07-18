import { describe, expect, test } from 'bun:test'
import { makeInMemoryArtifactStoreLayer } from '@cv/application-registry-artifact-store/test-support'
import { Effect, Layer } from 'effect'

import { OpaqueObjectsService } from '../services/opaque-objects'
import { OpaqueObjectsServiceLive } from './opaque-objects'

const live = OpaqueObjectsServiceLive.pipe(
  Layer.provide(makeInMemoryArtifactStoreLayer())
)

describe('OpaqueObjectsService', () => {
  test('stores the exact bytes supplied when put is called', async () => {
    const input = new Uint8Array([1, 2, 3, 4])
    const stored = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* OpaqueObjectsService
        const pending = service.put(input)
        input[0] = 99
        const metadata = yield* pending
        const bytes = yield* service.read(metadata.sha256)
        return { bytes, metadata }
      }).pipe(Effect.provide(live))
    )

    expect([...stored.bytes]).toEqual([1, 2, 3, 4])
    expect(stored.metadata.byteLength).toBe(4)
    expect(stored.metadata.key).toBe(`sha256/${stored.metadata.sha256}`)
  })

  test('returns independent byte arrays for every read', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* OpaqueObjectsService
        const metadata = yield* service.put(new Uint8Array([7, 8, 9]))
        const first = yield* service.read(metadata.sha256)
        first[0] = 0
        const second = yield* service.read(metadata.sha256)
        return { first, second }
      }).pipe(Effect.provide(live))
    )

    expect([...result.first]).toEqual([0, 8, 9])
    expect([...result.second]).toEqual([7, 8, 9])
  })

  test('normalizes artifact-store failures at the service boundary', async () => {
    const error = await Effect.runPromise(
      OpaqueObjectsService.use((service) => service.read('not-a-sha')).pipe(
        Effect.flip,
        Effect.provide(live)
      )
    )

    expect(error._tag).toBe('RegistryArtifactError')
    expect(error.operation).toBe('read')
  })
})
