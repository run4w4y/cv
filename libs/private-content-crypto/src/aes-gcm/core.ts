import { Effect, Crypto as PlatformCrypto } from 'effect'
import { toBufferSource, toOptionalBufferSource } from '../bytes'
import {
  type ContentEncryptionKey,
  contentEncryptionKeyBytes,
} from '../content-key'
import {
  PrivateCryptoOperationError,
  type PrivateCryptoUnavailableError,
} from '../errors'
import { WebCryptoApi } from '../web-crypto'

export const aesGcmIvByteLength = 12
export const aesGcmTagByteLength = 16

export type AesGcmBytes = {
  readonly ciphertext: Uint8Array
  readonly iv: Uint8Array
}

export const importAesGcmCryptoKey = (
  key: ContentEncryptionKey,
  keyUsages: KeyUsage[]
): Effect.Effect<CryptoKey, PrivateCryptoOperationError, WebCryptoApi> =>
  WebCryptoApi.pipe(
    Effect.flatMap((crypto) =>
      Effect.tryPromise({
        try: () =>
          crypto.subtle.importKey(
            'raw',
            toBufferSource(contentEncryptionKeyBytes(key)),
            'AES-GCM',
            false,
            keyUsages
          ),
        catch: (cause) =>
          new PrivateCryptoOperationError({
            cause,
            operation: 'AES-GCM importKey',
          }),
      })
    )
  )

const randomAesGcmIv: Effect.Effect<
  Uint8Array,
  PrivateCryptoOperationError,
  PlatformCrypto.Crypto
> = PlatformCrypto.Crypto.pipe(
  Effect.flatMap((crypto) => crypto.randomBytes(aesGcmIvByteLength)),
  Effect.mapError(
    (cause) =>
      new PrivateCryptoOperationError({
        cause,
        operation: 'AES-GCM random IV',
      })
  )
)

export const encryptAesGcmBytes = (
  key: ContentEncryptionKey,
  plaintext: Uint8Array,
  associatedData?: Uint8Array
): Effect.Effect<
  AesGcmBytes,
  PrivateCryptoUnavailableError | PrivateCryptoOperationError,
  WebCryptoApi | PlatformCrypto.Crypto
> =>
  Effect.gen(function* () {
    const crypto = yield* WebCryptoApi
    const cryptoKey = yield* importAesGcmCryptoKey(key, ['encrypt'])
    const iv = yield* randomAesGcmIv
    const ciphertext = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.encrypt(
          {
            additionalData: toOptionalBufferSource(associatedData),
            iv: toBufferSource(iv),
            name: 'AES-GCM',
          },
          cryptoKey,
          toBufferSource(plaintext)
        ),
      catch: (cause) =>
        new PrivateCryptoOperationError({
          cause,
          operation: 'AES-GCM encrypt',
        }),
    })

    return {
      ciphertext: new Uint8Array(ciphertext),
      iv,
    } satisfies AesGcmBytes
  })

export const decryptAesGcmBytes = (
  key: ContentEncryptionKey,
  { ciphertext, iv }: AesGcmBytes,
  associatedData?: Uint8Array
): Effect.Effect<
  Uint8Array,
  PrivateCryptoUnavailableError | PrivateCryptoOperationError,
  WebCryptoApi
> =>
  Effect.gen(function* () {
    const crypto = yield* WebCryptoApi
    const cryptoKey = yield* importAesGcmCryptoKey(key, ['decrypt'])
    const plaintext = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.decrypt(
          {
            additionalData: toOptionalBufferSource(associatedData),
            iv: toBufferSource(iv),
            name: 'AES-GCM',
          },
          cryptoKey,
          toBufferSource(ciphertext)
        ),
      catch: (cause) =>
        new PrivateCryptoOperationError({
          cause,
          operation: 'AES-GCM decrypt',
        }),
    })

    return new Uint8Array(plaintext)
  })
