import { describe, expect, test } from 'bun:test'
import { Effect, Option } from 'effect'

import {
  ArtifactStoreIntegrityError,
  ArtifactStoreNotFoundError,
  ArtifactStoreReadError,
  ArtifactStoreWriteError,
} from '../index'
import { type ArtifactR2Bucket, makeR2ArtifactStore } from './r2'

type FakeObject = {
  bytes: Uint8Array
  checksum: ArrayBuffer
  customMetadata: Record<string, string>
  key: string
}

const makeFakeR2Bucket = () => {
  const objects = new Map<string, FakeObject>()
  let writes = 0

  const metadata = (object: FakeObject) => ({
    checksums: { sha256: object.checksum },
    customMetadata: { ...object.customMetadata },
    key: object.key,
    size: object.bytes.byteLength,
  })

  const bucket: ArtifactR2Bucket = {
    get: async (key) => {
      const object = objects.get(key)
      return object
        ? {
            ...metadata(object),
            bytes: async () => object.bytes.slice(),
          }
        : null
    },
    head: async (key) => {
      const object = objects.get(key)
      return object ? metadata(object) : null
    },
    put: async (key, value, options) => {
      if (objects.has(key)) {
        return null
      }

      const object: FakeObject = {
        bytes: value.slice(),
        checksum: options.sha256.slice().buffer,
        customMetadata: { ...options.customMetadata },
        key,
      }
      objects.set(key, object)
      writes += 1
      return metadata(object)
    },
  }

  return {
    bucket,
    corruptBody: (key: string, bytes: Uint8Array) => {
      const object = objects.get(key)
      if (object) {
        object.bytes = bytes.slice()
      }
    },
    corruptMetadata: (key: string) => {
      const object = objects.get(key)
      if (object) {
        object.customMetadata.sha256 = '0'.repeat(64)
      }
    },
    writes: () => writes,
  }
}

describe('R2 ArtifactStore', () => {
  test('uses conditional writes and treats an existing object as success', async () => {
    const r2 = makeFakeR2Bucket()
    const store = makeR2ArtifactStore(r2.bucket)
    const input = new TextEncoder().encode('immutable')
    const first = await Effect.runPromise(store.put(input))
    input.fill(0)
    const second = await Effect.runPromise(
      store.put(new TextEncoder().encode('immutable'))
    )
    const head = await Effect.runPromise(store.head(first.sha256))
    const bytes = await Effect.runPromise(store.read(first.sha256))

    expect(r2.writes()).toBe(1)
    expect(second).toEqual(first)
    expect(Option.getOrNull(head)).toEqual(first)
    expect(new TextDecoder().decode(bytes)).toBe('immutable')
  })

  test('detects body corruption by recomputing SHA-256 on read', async () => {
    const r2 = makeFakeR2Bucket()
    const store = makeR2ArtifactStore(r2.bucket)
    const metadata = await Effect.runPromise(
      store.put(new TextEncoder().encode('original'))
    )
    r2.corruptBody(metadata.key, new TextEncoder().encode('tampered'))

    const error = await Effect.runPromise(
      Effect.flip(store.read(metadata.sha256))
    )
    expect(error).toBeInstanceOf(ArtifactStoreIntegrityError)
  })

  test('detects inconsistent object metadata on head', async () => {
    const r2 = makeFakeR2Bucket()
    const store = makeR2ArtifactStore(r2.bucket)
    const metadata = await Effect.runPromise(
      store.put(new TextEncoder().encode('metadata'))
    )
    r2.corruptMetadata(metadata.key)

    const error = await Effect.runPromise(
      Effect.flip(store.head(metadata.sha256))
    )
    expect(error).toBeInstanceOf(ArtifactStoreIntegrityError)
  })

  test('returns a typed not-found error for a missing object body', async () => {
    const r2 = makeFakeR2Bucket()
    const store = makeR2ArtifactStore(r2.bucket)
    const error = await Effect.runPromise(
      Effect.flip(store.read('0'.repeat(64)))
    )

    expect(error).toBeInstanceOf(ArtifactStoreNotFoundError)
  })

  test('normalizes foreign R2 failures at the storage boundary', async () => {
    const readFailure = new Error('read unavailable')
    const writeFailure = new Error('write unavailable')
    const failingBucket: ArtifactR2Bucket = {
      get: async () => Promise.reject(readFailure),
      head: async () => Promise.reject(readFailure),
      put: async () => Promise.reject(writeFailure),
    }
    const store = makeR2ArtifactStore(failingBucket)
    const readError = await Effect.runPromise(
      Effect.flip(store.read('0'.repeat(64)))
    )
    const writeError = await Effect.runPromise(
      Effect.flip(store.put(new TextEncoder().encode('write')))
    )

    expect(readError).toBeInstanceOf(ArtifactStoreReadError)
    expect(readError.cause).toBe(readFailure)
    expect(writeError).toBeInstanceOf(ArtifactStoreWriteError)
    expect(writeError.cause).toBe(writeFailure)
  })
})
