import { Effect } from 'effect'
import { concatBytes } from './bytes'
import {
  type ContentEncryptionKey,
  contentEncryptionKeyBytes,
} from './content-key'
import { base64UrlEncode, utf8ToBytes } from './encoding'
import { PrivateCryptoOperationError } from './errors'
import { WebCryptoApi } from './web-crypto'

export const privateProfileSelectorByteLength = 8

const selectorDomain = utf8ToBytes('cv.private-content.profile-selector.v1\0')

const bufferSource = (bytes: Uint8Array) => bytes.slice()

export const privateProfileSelectorFromContentKey = (
  key: ContentEncryptionKey
): Effect.Effect<string, PrivateCryptoOperationError, WebCryptoApi> =>
  WebCryptoApi.pipe(
    Effect.flatMap((crypto) =>
      Effect.tryPromise({
        try: async () => {
          const digest = await crypto.subtle.digest(
            'SHA-256',
            bufferSource(
              concatBytes(selectorDomain, contentEncryptionKeyBytes(key))
            )
          )

          return base64UrlEncode(
            new Uint8Array(digest).slice(0, privateProfileSelectorByteLength)
          )
        },
        catch: (cause) =>
          new PrivateCryptoOperationError({
            cause,
            operation: 'private profile selector SHA-256',
          }),
      })
    )
  )
