import { Effect } from 'effect'

import { FactsReleaseHashError } from '../errors'

const hex = (bytes: Uint8Array) => {
  let output = ''
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, '0')
  }
  return output
}

export const sha256Hex = (
  bytes: Uint8Array
): Effect.Effect<string, FactsReleaseHashError> =>
  Effect.suspend(() => {
    const cryptoApi = globalThis.crypto
    if (!cryptoApi?.subtle) {
      return Effect.fail(
        new FactsReleaseHashError({
          cause: new Error('Web Crypto is unavailable.'),
          message: 'Could not calculate a facts release SHA-256 digest.',
        })
      )
    }

    return Effect.tryPromise({
      try: async () => {
        const digest = await cryptoApi.subtle.digest('SHA-256', bytes.slice())
        return hex(new Uint8Array(digest))
      },
      catch: (cause) =>
        new FactsReleaseHashError({
          cause,
          message: 'Could not calculate a facts release SHA-256 digest.',
        }),
    })
  })

export const contentAddress = (sha256: string) => `sha256/${sha256}`
