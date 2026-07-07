import {
  Context,
  Effect,
  Layer,
  Crypto as PlatformCrypto,
  PlatformError,
} from 'effect'
import { toBufferSource } from './bytes'
import { PrivateCryptoUnavailableError } from './errors'

export class WebCryptoApi extends Context.Service<WebCryptoApi, Crypto>()(
  '@cv/private-content-crypto/WebCryptoApi'
) {}

const resolveGlobalWebCryptoApi: Effect.Effect<
  Crypto,
  PrivateCryptoUnavailableError
> = Effect.suspend(() => {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    return Effect.fail(PrivateCryptoUnavailableError.unavailable())
  }

  return Effect.succeed(globalThis.crypto)
})

const randomBytesFromWebCryptoApi = (crypto: Crypto, length: number) => {
  const output = new Uint8Array(length)

  for (let offset = 0; offset < length; offset += 65536) {
    crypto.getRandomValues(
      output.subarray(offset, Math.min(offset + 65536, length))
    )
  }

  return output
}

const platformCryptoFromWebCryptoApi = (
  crypto: Crypto
): PlatformCrypto.Crypto =>
  PlatformCrypto.make({
    randomBytes: (size) => randomBytesFromWebCryptoApi(crypto, size),
    digest: (algorithm, data) =>
      Effect.tryPromise({
        try: async () =>
          new Uint8Array(
            await crypto.subtle.digest(algorithm, toBufferSource(data))
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

export const WebCryptoApiLayer = Layer.effect(
  WebCryptoApi,
  resolveGlobalWebCryptoApi
)

export const BrowserCryptoLayer = Layer.effect(
  PlatformCrypto.Crypto,
  resolveGlobalWebCryptoApi.pipe(Effect.map(platformCryptoFromWebCryptoApi))
)

export const PrivateCryptoLayer = Layer.merge(
  WebCryptoApiLayer,
  BrowserCryptoLayer
)

export const runPrivateCryptoPromise = <A, E>(
  effect: Effect.Effect<A, E, WebCryptoApi | PlatformCrypto.Crypto>
) => Effect.runPromise(effect.pipe(Effect.provide(PrivateCryptoLayer)))
