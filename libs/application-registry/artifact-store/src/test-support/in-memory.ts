import { Effect, Layer, Option } from 'effect'

import {
  ArtifactStoreIntegrityError,
  ArtifactStoreNotFoundError,
} from '../errors'
import { artifactKey, validateSha256 } from '../internal/address'
import { sha256 } from '../internal/hash'
import { verifyArtifactBytes } from '../internal/metadata'
import {
  type ArtifactMetadata,
  ArtifactStore,
  type ArtifactStoreShape,
} from '../service'

type MemoryArtifact = {
  readonly bytes: Uint8Array
  readonly metadata: ArtifactMetadata
}

const makeInMemoryArtifactStore = (): ArtifactStoreShape => {
  const objects = new Map<string, MemoryArtifact>()

  return {
    head: (requestedSha256) =>
      Effect.gen(function* () {
        const digest = yield* validateSha256(requestedSha256)
        const stored = objects.get(digest)
        return stored ? Option.some(stored.metadata) : Option.none()
      }),
    put: (input) =>
      Effect.gen(function* () {
        const bytes = input.slice()
        const digest = yield* sha256(bytes)
        const existing = objects.get(digest.hex)
        if (existing) {
          if (existing.bytes.byteLength !== bytes.byteLength) {
            return yield* new ArtifactStoreIntegrityError({
              key: existing.metadata.key,
              message: `Artifact "${existing.metadata.key}" already exists with another byte length.`,
              sha256: digest.hex,
            })
          }

          for (let index = 0; index < bytes.byteLength; index += 1) {
            if (bytes[index] !== existing.bytes[index]) {
              return yield* new ArtifactStoreIntegrityError({
                key: existing.metadata.key,
                message: `Artifact "${existing.metadata.key}" already exists with different bytes.`,
                sha256: digest.hex,
              })
            }
          }

          return existing.metadata
        }

        const metadata: ArtifactMetadata = {
          byteLength: bytes.byteLength,
          key: artifactKey(digest.hex),
          sha256: digest.hex,
        }
        objects.set(digest.hex, { bytes, metadata })
        return metadata
      }),
    read: (requestedSha256) =>
      Effect.gen(function* () {
        const digest = yield* validateSha256(requestedSha256)
        const stored = objects.get(digest)
        if (!stored) {
          const key = artifactKey(digest)
          return yield* new ArtifactStoreNotFoundError({
            key,
            message: `Artifact "${key}" does not exist.`,
            sha256: digest,
          })
        }

        const actualDigest = yield* sha256(stored.bytes)
        yield* verifyArtifactBytes(
          stored.bytes,
          stored.metadata,
          actualDigest.hex
        )
        return stored.bytes.slice()
      }),
  }
}

export const makeInMemoryArtifactStoreLayer = () =>
  Layer.effect(ArtifactStore, Effect.sync(makeInMemoryArtifactStore))

export const InMemoryArtifactStoreLayer = makeInMemoryArtifactStoreLayer()
