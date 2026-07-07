import { Effect, type Crypto as PlatformCrypto } from 'effect'
import { concatBytes } from '../bytes'
import type { ContentEncryptionKey } from '../content-key'
import {
  type PrivateCryptoOperationError,
  PrivateCryptoPayloadError,
  type PrivateCryptoUnavailableError,
} from '../errors'
import type { WebCryptoApi } from '../web-crypto'
import {
  aesGcmIvByteLength,
  aesGcmTagByteLength,
  decryptAesGcmBytes,
  encryptAesGcmBytes,
} from './core'

export const privateFilePayloadMagic = new Uint8Array([0x50, 0x43, 0x46, 0x32])

const privateFilePayloadHeaderLength =
  privateFilePayloadMagic.byteLength + aesGcmIvByteLength

const validatePrivateFilePayloadMagic = (
  payload: Uint8Array
): Effect.Effect<void, PrivateCryptoPayloadError> => {
  for (const [index, byte] of privateFilePayloadMagic.entries()) {
    if (payload[index] !== byte) {
      return Effect.fail(
        new PrivateCryptoPayloadError({
          reason: 'unsupported private file payload',
        })
      )
    }
  }

  return Effect.void
}

const decodePrivateFilePayload = (
  payload: Uint8Array
): Effect.Effect<
  { readonly ciphertext: Uint8Array; readonly iv: Uint8Array },
  PrivateCryptoPayloadError
> =>
  Effect.gen(function* () {
    if (
      payload.byteLength <
      privateFilePayloadHeaderLength + aesGcmTagByteLength
    ) {
      return yield* new PrivateCryptoPayloadError({
        reason: 'truncated private file payload',
      })
    }

    yield* validatePrivateFilePayloadMagic(payload)

    return {
      ciphertext: payload.slice(privateFilePayloadHeaderLength),
      iv: payload.slice(
        privateFilePayloadMagic.byteLength,
        privateFilePayloadHeaderLength
      ),
    }
  })

export const encryptPrivateFilePayload = (
  key: ContentEncryptionKey,
  plaintext: Uint8Array,
  associatedData?: Uint8Array
): Effect.Effect<
  Uint8Array,
  PrivateCryptoUnavailableError | PrivateCryptoOperationError,
  WebCryptoApi | PlatformCrypto.Crypto
> =>
  encryptAesGcmBytes(key, plaintext, associatedData).pipe(
    Effect.map(({ ciphertext, iv }) =>
      concatBytes(privateFilePayloadMagic, iv, ciphertext)
    )
  )

export const decryptPrivateFilePayload = (
  key: ContentEncryptionKey,
  payload: Uint8Array,
  associatedData?: Uint8Array
): Effect.Effect<
  Uint8Array,
  | PrivateCryptoUnavailableError
  | PrivateCryptoOperationError
  | PrivateCryptoPayloadError,
  WebCryptoApi
> =>
  decodePrivateFilePayload(payload).pipe(
    Effect.flatMap((encrypted) =>
      decryptAesGcmBytes(key, encrypted, associatedData)
    )
  )
