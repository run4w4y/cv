import { Crypto, Effect, Layer, PlatformError } from 'effect'

const randomBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size)

  for (let offset = 0; offset < size; offset += 65_536) {
    globalThis.crypto.getRandomValues(
      bytes.subarray(offset, Math.min(offset + 65_536, size))
    )
  }

  return bytes
}

const browserCrypto = Crypto.make({
  randomBytes,
  digest: (algorithm, data) =>
    Effect.tryPromise({
      try: async () =>
        new Uint8Array(
          await globalThis.crypto.subtle.digest(algorithm, data.slice().buffer)
        ),
      catch: (cause) =>
        PlatformError.systemError({
          _tag: 'Unknown',
          cause,
          method: 'digest',
          module: 'Crypto',
        }),
    }),
})

/** Web Crypto adapter for Effect's platform-independent Crypto service. */
export const WebCryptoLayer = Layer.succeed(Crypto.Crypto, browserCrypto)
