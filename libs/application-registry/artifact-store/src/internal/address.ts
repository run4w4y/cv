import { Effect } from 'effect'

import { ArtifactStoreAddressError } from '../errors'

const sha256Pattern = /^[0-9a-f]{64}$/u

export const artifactKey = (sha256: string) => `sha256/${sha256}`

export const validateSha256 = (
  sha256: string
): Effect.Effect<string, ArtifactStoreAddressError> =>
  sha256Pattern.test(sha256)
    ? Effect.succeed(sha256)
    : Effect.fail(
        new ArtifactStoreAddressError({
          message:
            'Artifact SHA-256 must contain 64 lowercase hexadecimal characters.',
          sha256,
        })
      )
