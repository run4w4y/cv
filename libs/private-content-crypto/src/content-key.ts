import { Effect, Crypto as PlatformCrypto } from 'effect'
import { base64UrlEncode, normalizeSecretBytes } from './encoding'
import {
  type PrivateCryptoError,
  PrivateCryptoInvalidKeyError,
  PrivateCryptoOperationError,
} from './errors'

export const contentEncryptionKeyByteLength = 32

const contentEncryptionKeyBytesSymbol: unique symbol = Symbol(
  '@cv/private-content-crypto/ContentEncryptionKey/bytes'
)

export type ContentEncryptionKey = {
  readonly alg: 'PRIVATE-CONTENT-KEY'
  readonly byteLength: typeof contentEncryptionKeyByteLength
  readonly [contentEncryptionKeyBytesSymbol]: Uint8Array
}

export const createContentEncryptionKey = (
  bytes: Uint8Array,
  label = 'content encryption key'
): Effect.Effect<ContentEncryptionKey, PrivateCryptoInvalidKeyError> =>
  bytes.byteLength === contentEncryptionKeyByteLength
    ? Effect.succeed(
        Object.freeze({
          [contentEncryptionKeyBytesSymbol]: bytes.slice(),
          alg: 'PRIVATE-CONTENT-KEY',
          byteLength: contentEncryptionKeyByteLength,
        })
      )
    : Effect.fail(
        new PrivateCryptoInvalidKeyError({
          actualBytes: bytes.byteLength,
          expectedBytes: contentEncryptionKeyByteLength,
          label,
        })
      )

export const parseContentEncryptionKey = (
  secret: string,
  label = 'content encryption key'
): Effect.Effect<ContentEncryptionKey, PrivateCryptoError> =>
  normalizeSecretBytes(secret).pipe(
    Effect.flatMap((bytes) => createContentEncryptionKey(bytes, label))
  )

export const generateContentEncryptionKey = (): Effect.Effect<
  ContentEncryptionKey,
  PrivateCryptoError,
  PlatformCrypto.Crypto
> =>
  PlatformCrypto.Crypto.pipe(
    Effect.flatMap((crypto) =>
      crypto.randomBytes(contentEncryptionKeyByteLength)
    ),
    Effect.mapError(
      (cause) =>
        new PrivateCryptoOperationError({
          cause,
          operation: 'randomBytes',
        })
    ),
    Effect.flatMap((bytes) => createContentEncryptionKey(bytes))
  )

export const contentEncryptionKeyBytes = (key: ContentEncryptionKey) =>
  key[contentEncryptionKeyBytesSymbol].slice()

export const encodeContentEncryptionKeySecret = (key: ContentEncryptionKey) =>
  `base64url:${base64UrlEncode(contentEncryptionKeyBytes(key))}`
