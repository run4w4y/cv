import { Effect } from 'effect'

import { ArtifactStoreIntegrityError } from '../errors'
import type { ArtifactMetadata } from '../service'
import { artifactKey } from './address'
import { hexFromBytes } from './hash'

export type ArtifactObjectMetadata = {
  readonly checksums: {
    readonly sha256?: ArrayBuffer
  }
  readonly customMetadata?: Record<string, string>
  readonly key: string
  readonly size: number
}

const integrityFailure = (sha256: string, message: string) =>
  Effect.fail(
    new ArtifactStoreIntegrityError({
      key: artifactKey(sha256),
      message,
      sha256,
    })
  )

export const verifyObjectMetadata = (
  object: ArtifactObjectMetadata,
  sha256: string
): Effect.Effect<ArtifactMetadata, ArtifactStoreIntegrityError> =>
  Effect.gen(function* () {
    const key = artifactKey(sha256)
    if (object.key !== key) {
      return yield* integrityFailure(
        sha256,
        `Artifact storage returned key "${object.key}" for "${key}".`
      )
    }

    if (!Number.isSafeInteger(object.size) || object.size < 0) {
      return yield* integrityFailure(
        sha256,
        `Artifact "${key}" has an invalid byte length.`
      )
    }

    if (object.customMetadata?.sha256 !== sha256) {
      return yield* integrityFailure(
        sha256,
        `Artifact "${key}" has inconsistent SHA-256 metadata.`
      )
    }

    if (object.customMetadata.byteLength !== String(object.size)) {
      return yield* integrityFailure(
        sha256,
        `Artifact "${key}" has inconsistent byte-length metadata.`
      )
    }

    const checksum = object.checksums.sha256
    if (checksum && hexFromBytes(new Uint8Array(checksum)) !== sha256) {
      return yield* integrityFailure(
        sha256,
        `Artifact "${key}" has an inconsistent storage checksum.`
      )
    }

    return {
      byteLength: object.size,
      key,
      sha256,
    }
  })

export const verifyArtifactBytes = (
  bytes: Uint8Array,
  metadata: ArtifactMetadata,
  actualSha256: string
): Effect.Effect<void, ArtifactStoreIntegrityError> => {
  if (bytes.byteLength !== metadata.byteLength) {
    return integrityFailure(
      metadata.sha256,
      `Artifact "${metadata.key}" has an unexpected byte length.`
    )
  }

  if (actualSha256 !== metadata.sha256) {
    return integrityFailure(
      metadata.sha256,
      `Artifact "${metadata.key}" content does not match its SHA-256.`
    )
  }

  return Effect.void
}
