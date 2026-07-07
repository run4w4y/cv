import { Effect, type Crypto as PlatformCrypto } from 'effect'
import type { ContentEncryptionKey } from '../content-key'
import { base64UrlDecode, base64UrlEncode } from '../encoding'
import {
  type PrivateCryptoInvalidBase64UrlError,
  type PrivateCryptoOperationError,
  PrivateCryptoPayloadError,
  type PrivateCryptoUnavailableError,
} from '../errors'
import type { WebCryptoApi } from '../web-crypto'
import { decryptAesGcmBytes, encryptAesGcmBytes } from './core'

export type EncryptedPayload = {
  alg: 'AES-GCM'
  ciphertext: string
  iv: string
}

const validateEncryptedPayload = (
  payload: EncryptedPayload
): Effect.Effect<void, PrivateCryptoPayloadError> =>
  payload.alg === 'AES-GCM'
    ? Effect.void
    : Effect.fail(
        new PrivateCryptoPayloadError({ reason: 'unsupported algorithm' })
      )

export const encryptAesGcmPayload = (
  key: ContentEncryptionKey,
  plaintext: Uint8Array,
  associatedData?: Uint8Array
): Effect.Effect<
  EncryptedPayload,
  PrivateCryptoUnavailableError | PrivateCryptoOperationError,
  WebCryptoApi | PlatformCrypto.Crypto
> =>
  Effect.gen(function* () {
    const { ciphertext, iv } = yield* encryptAesGcmBytes(
      key,
      plaintext,
      associatedData
    )

    return {
      alg: 'AES-GCM',
      ciphertext: base64UrlEncode(ciphertext),
      iv: base64UrlEncode(iv),
    } satisfies EncryptedPayload
  })

export const decryptAesGcmPayload = (
  key: ContentEncryptionKey,
  payload: EncryptedPayload,
  associatedData?: Uint8Array
): Effect.Effect<
  Uint8Array,
  | PrivateCryptoUnavailableError
  | PrivateCryptoOperationError
  | PrivateCryptoInvalidBase64UrlError
  | PrivateCryptoPayloadError,
  WebCryptoApi
> =>
  Effect.gen(function* () {
    yield* validateEncryptedPayload(payload)
    const ciphertext = yield* base64UrlDecode(payload.ciphertext)
    const iv = yield* base64UrlDecode(payload.iv)
    return yield* decryptAesGcmBytes(key, { ciphertext, iv }, associatedData)
  })
