import {
  base64UrlDecode,
  contentEncryptionKeyByteLength,
  createContentEncryptionKey,
  type PrivateCryptoError,
  privateProfileSelectorFromContentKey,
  type WebCryptoApi,
} from '@cv/private-content-crypto'
import { Effect } from 'effect'
import { PRIVATE_CAPABILITY_TOKEN_VERSION } from './constants'
import {
  type PrivateCapabilityTokenError,
  PrivateCapabilityTokenFormatError,
} from './errors'
import type { PrivateCapability } from './types'

const tokenByteLength = contentEncryptionKeyByteLength + 1

export const decodePrivateCapabilityToken = (
  token: string
): Effect.Effect<
  PrivateCapability,
  PrivateCapabilityTokenError | PrivateCryptoError,
  WebCryptoApi
> =>
  Effect.gen(function* () {
    const bytes = yield* base64UrlDecode(token)

    if (bytes.byteLength !== tokenByteLength) {
      return yield* Effect.fail(
        new PrivateCapabilityTokenFormatError({
          message: `Private capability token must decode to ${tokenByteLength} bytes`,
        })
      )
    }

    if (bytes[0] !== PRIVATE_CAPABILITY_TOKEN_VERSION) {
      return yield* Effect.fail(
        new PrivateCapabilityTokenFormatError({
          message: 'Private capability token has unsupported version',
        })
      )
    }

    const profileContentKey = yield* createContentEncryptionKey(
      bytes.slice(1),
      'profile content key from private capability token'
    )

    return {
      profileContentKey,
      profileSelector:
        yield* privateProfileSelectorFromContentKey(profileContentKey),
    }
  })
