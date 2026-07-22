import { describe, expect, test } from 'bun:test'
import { Effect, Option } from 'effect'

import {
  ArtifactStore,
  ArtifactStoreAddressError,
  ArtifactStoreNotFoundError,
} from '../index'
import { makeInMemoryArtifactStoreLayer } from './in-memory'

const helloSha256 =
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'

const runWithStore = <A, E>(effect: Effect.Effect<A, E, ArtifactStore>) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(makeInMemoryArtifactStoreLayer()))
  )

describe('in-memory ArtifactStore', () => {
  test('stores and reads immutable content-addressed bytes', async () => {
    const source = new TextEncoder().encode('hello')
    const result = await runWithStore(
      Effect.gen(function* () {
        const store = yield* ArtifactStore
        const metadata = yield* store.put(source)
        source.fill(0)
        const firstRead = yield* store.read(metadata.sha256)
        firstRead.fill(0)
        const secondRead = yield* store.read(metadata.sha256)
        return { metadata, secondRead }
      })
    )

    expect(result.metadata).toEqual({
      byteLength: 5,
      key: `sha256/${helloSha256}`,
      sha256: helloSha256,
    })
    expect(new TextDecoder().decode(result.secondRead)).toBe('hello')
  })

  test('makes repeated puts idempotent', async () => {
    const result = await runWithStore(
      Effect.gen(function* () {
        const store = yield* ArtifactStore
        const first = yield* store.put(new TextEncoder().encode('hello'))
        const second = yield* store.put(new TextEncoder().encode('hello'))
        const head = yield* store.head(first.sha256)
        return { first, head, second, surface: Object.keys(store).sort() }
      })
    )

    expect(result.second).toEqual(result.first)
    expect(Option.getOrNull(result.head)).toEqual(result.first)
    expect(result.surface).toEqual(['head', 'put', 'read'])
  })

  test('returns none from head and a typed error from read when absent', async () => {
    const missingSha256 = '0'.repeat(64)
    const result = await runWithStore(
      Effect.gen(function* () {
        const store = yield* ArtifactStore
        const head = yield* store.head(missingSha256)
        const readError = yield* Effect.flip(store.read(missingSha256))
        return { head, readError }
      })
    )

    expect(Option.isNone(result.head)).toBe(true)
    expect(result.readError).toBeInstanceOf(ArtifactStoreNotFoundError)
    if (result.readError._tag !== 'ArtifactStoreNotFoundError') {
      throw new Error('Expected ArtifactStoreNotFoundError.')
    }
    expect(result.readError.sha256).toBe(missingSha256)
  })

  test('rejects malformed addresses without touching storage', async () => {
    const error = await runWithStore(
      Effect.gen(function* () {
        const store = yield* ArtifactStore
        return yield* Effect.flip(store.head('ABC'))
      })
    )

    expect(error).toBeInstanceOf(ArtifactStoreAddressError)
  })
})
