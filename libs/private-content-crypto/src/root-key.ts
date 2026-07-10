import { Effect } from 'effect'
import type * as Redacted from 'effect/Redacted'
import { toBufferSource } from './bytes'
import {
  type ContentEncryptionKey,
  createContentEncryptionKey,
} from './content-key'
import {
  normalizeRedactedSecretBytes,
  normalizeSecretBytes,
  utf8ToBytes,
} from './encoding'
import {
  type PrivateCryptoError,
  PrivateCryptoInvalidKeyError,
  PrivateCryptoOperationError,
} from './errors'
import { WebCryptoApi } from './web-crypto'

export const privateContentRootKeyByteLength = 32

const privateContentRootKeyBytesSymbol: unique symbol = Symbol(
  '@cv/private-content-crypto/PrivateContentRootKey/bytes'
)

export type PrivateContentRootKey = {
  readonly alg: 'PRIVATE-CONTENT-ROOT-KEY'
  readonly byteLength: typeof privateContentRootKeyByteLength
  readonly [privateContentRootKeyBytesSymbol]: Uint8Array
}

export const createPrivateContentRootKey = (
  bytes: Uint8Array,
  label = 'private content root key'
): Effect.Effect<PrivateContentRootKey, PrivateCryptoInvalidKeyError> =>
  bytes.byteLength === privateContentRootKeyByteLength
    ? Effect.succeed(
        Object.freeze({
          [privateContentRootKeyBytesSymbol]: bytes.slice(),
          alg: 'PRIVATE-CONTENT-ROOT-KEY',
          byteLength: privateContentRootKeyByteLength,
        })
      )
    : Effect.fail(
        new PrivateCryptoInvalidKeyError({
          actualBytes: bytes.byteLength,
          expectedBytes: privateContentRootKeyByteLength,
          label,
        })
      )

export const parsePrivateContentRootKey = (
  secret: string,
  label = 'private content root key'
): Effect.Effect<PrivateContentRootKey, PrivateCryptoError> =>
  normalizeSecretBytes(secret).pipe(
    Effect.flatMap((bytes) => createPrivateContentRootKey(bytes, label))
  )

export const parseRedactedPrivateContentRootKey = (
  secret: Redacted.Redacted<string>,
  label = 'private content root key'
): Effect.Effect<PrivateContentRootKey, PrivateCryptoError> =>
  normalizeRedactedSecretBytes(secret).pipe(
    Effect.flatMap((bytes) => createPrivateContentRootKey(bytes, label))
  )

const privateContentRootKeyBytes = (key: PrivateContentRootKey) =>
  key[privateContentRootKeyBytesSymbol].slice()

const profileKeyHkdfSalt = utf8ToBytes(
  'cv.private-content.profile-content-key.hkdf-salt.v1'
)

const profileKeyHkdfInfo = (profileId: string) =>
  utf8ToBytes(`cv.private-content.profile-content-key.v1\0${profileId}`)

export const deriveProfileContentKey = ({
  profileId,
  rootKey,
}: {
  readonly profileId: string
  readonly rootKey: PrivateContentRootKey
}): Effect.Effect<ContentEncryptionKey, PrivateCryptoError, WebCryptoApi> =>
  WebCryptoApi.pipe(
    Effect.flatMap((crypto) =>
      Effect.tryPromise({
        try: async () => {
          const hkdfKey = await crypto.subtle.importKey(
            'raw',
            toBufferSource(privateContentRootKeyBytes(rootKey)),
            'HKDF',
            false,
            ['deriveBits']
          )
          const derivedBits = await crypto.subtle.deriveBits(
            {
              hash: 'SHA-256',
              info: toBufferSource(profileKeyHkdfInfo(profileId)),
              name: 'HKDF',
              salt: toBufferSource(profileKeyHkdfSalt),
            },
            hkdfKey,
            privateContentRootKeyByteLength * 8
          )

          return new Uint8Array(derivedBits)
        },
        catch: (cause) =>
          new PrivateCryptoOperationError({
            cause,
            operation: 'deriveProfileContentKey',
          }),
      })
    ),
    Effect.flatMap((bytes) =>
      createContentEncryptionKey(bytes, `Profile ${profileId} content key`)
    )
  )
