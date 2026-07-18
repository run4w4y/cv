import { Effect } from 'effect'

import { ArtifactStoreHashError } from '../errors'

export type Sha256Digest = {
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly hex: string
}

export const hexFromBytes = (bytes: Uint8Array) => {
  let output = ''

  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, '0')
  }

  return output
}

export const sha256 = (
  bytes: Uint8Array
): Effect.Effect<Sha256Digest, ArtifactStoreHashError> =>
  Effect.suspend(() => {
    const cryptoApi = globalThis.crypto
    if (!cryptoApi?.subtle) {
      return Effect.fail(
        new ArtifactStoreHashError({
          cause: new Error('Web Crypto is unavailable.'),
          message: 'Could not calculate the artifact SHA-256.',
        })
      )
    }

    return Effect.tryPromise({
      try: async () => {
        const digest = await cryptoApi.subtle.digest('SHA-256', bytes.slice())
        const digestBytes = new Uint8Array(digest)

        return {
          bytes: digestBytes,
          hex: hexFromBytes(digestBytes),
        }
      },
      catch: (cause) =>
        new ArtifactStoreHashError({
          cause,
          message: 'Could not calculate the artifact SHA-256.',
        }),
    })
  })
