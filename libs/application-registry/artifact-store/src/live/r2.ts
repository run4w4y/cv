import type { R2Bucket } from '@cloudflare/workers-types'
import { Effect, Layer, Option } from 'effect'

import {
  ArtifactStoreIntegrityError,
  ArtifactStoreNotFoundError,
  ArtifactStoreReadError,
  ArtifactStoreWriteError,
} from '../errors'
import { artifactKey, validateSha256 } from '../internal/address'
import { sha256 } from '../internal/hash'
import {
  type ArtifactObjectMetadata,
  verifyArtifactBytes,
  verifyObjectMetadata,
} from '../internal/metadata'
import {
  type ArtifactMetadata,
  ArtifactStore,
  type ArtifactStoreShape,
} from '../service'

type ArtifactObjectBody = ArtifactObjectMetadata & {
  readonly bytes: () => Promise<Uint8Array>
}

export type ArtifactR2Bucket = {
  readonly get: (key: string) => Promise<ArtifactObjectBody | null>
  readonly head: (key: string) => Promise<ArtifactObjectMetadata | null>
  readonly put: (
    key: string,
    value: Uint8Array,
    options: {
      readonly customMetadata: Record<string, string>
      readonly onlyIf: { readonly etagDoesNotMatch: string }
      readonly sha256: Uint8Array<ArrayBuffer>
    }
  ) => Promise<ArtifactObjectMetadata | null>
}

const readHead = (
  bucket: ArtifactR2Bucket,
  key: string,
  operation: 'head' | 'read'
) =>
  Effect.tryPromise({
    try: () => bucket.head(key),
    catch: (cause) =>
      new ArtifactStoreReadError({
        cause,
        key,
        message: `Could not ${operation} artifact "${key}".`,
        operation,
      }),
  })

const readObject = (bucket: ArtifactR2Bucket, key: string) =>
  Effect.tryPromise({
    try: () => bucket.get(key),
    catch: (cause) =>
      new ArtifactStoreReadError({
        cause,
        key,
        message: `Could not read artifact "${key}".`,
        operation: 'read',
      }),
  })

const readBytes = (object: ArtifactObjectBody, key: string) =>
  Effect.tryPromise({
    try: () => object.bytes(),
    catch: (cause) =>
      new ArtifactStoreReadError({
        cause,
        key,
        message: `Could not read artifact body "${key}".`,
        operation: 'read',
      }),
  })

export const makeR2ArtifactStore = (
  bucket: ArtifactR2Bucket
): ArtifactStoreShape => ({
  head: (requestedSha256) =>
    Effect.gen(function* () {
      const digest = yield* validateSha256(requestedSha256)
      const key = artifactKey(digest)
      const object = yield* readHead(bucket, key, 'head')
      if (!object) {
        return Option.none<ArtifactMetadata>()
      }

      return Option.some(yield* verifyObjectMetadata(object, digest))
    }),
  put: (input) =>
    Effect.gen(function* () {
      const bytes = input.slice()
      const digest = yield* sha256(bytes)
      const key = artifactKey(digest.hex)
      const customMetadata = {
        byteLength: String(bytes.byteLength),
        sha256: digest.hex,
      }
      const object = yield* Effect.tryPromise({
        try: () =>
          bucket.put(key, bytes, {
            customMetadata,
            onlyIf: { etagDoesNotMatch: '*' },
            sha256: digest.bytes,
          }),
        catch: (cause) =>
          new ArtifactStoreWriteError({
            cause,
            key,
            message: `Could not store artifact "${key}".`,
          }),
      })

      const stored = object ?? (yield* readHead(bucket, key, 'head'))
      if (!stored) {
        return yield* new ArtifactStoreWriteError({
          cause: new Error(
            'The conditional write failed without an existing object.'
          ),
          key,
          message: `Could not confirm artifact "${key}" after writing it.`,
        })
      }

      const metadata = yield* verifyObjectMetadata(stored, digest.hex)
      if (metadata.byteLength !== bytes.byteLength) {
        return yield* new ArtifactStoreIntegrityError({
          key,
          message: `Artifact "${key}" already exists with another byte length.`,
          sha256: digest.hex,
        })
      }

      return metadata
    }),
  read: (requestedSha256) =>
    Effect.gen(function* () {
      const digest = yield* validateSha256(requestedSha256)
      const key = artifactKey(digest)
      const object = yield* readObject(bucket, key)
      if (!object) {
        return yield* new ArtifactStoreNotFoundError({
          key,
          message: `Artifact "${key}" does not exist.`,
          sha256: digest,
        })
      }

      const metadata = yield* verifyObjectMetadata(object, digest)
      const bytes = yield* readBytes(object, key)
      const actualDigest = yield* sha256(bytes)
      yield* verifyArtifactBytes(bytes, metadata, actualDigest.hex)
      return bytes.slice()
    }),
})

export const makeR2ArtifactStoreLayer = <E, R>(
  bucket: Effect.Effect<R2Bucket, E, R>
) =>
  Layer.effect(
    ArtifactStore,
    bucket.pipe(Effect.map((resolved) => makeR2ArtifactStore(resolved)))
  )
