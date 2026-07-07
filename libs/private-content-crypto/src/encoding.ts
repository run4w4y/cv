import { base64, base64urlnopad } from '@scure/base'
import { Effect } from 'effect'
import {
  PrivateCryptoInvalidBase64Error,
  PrivateCryptoInvalidBase64UrlError,
} from './errors'

export { concatBytes } from './bytes'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const utf8ToBytes = (value: string) => encoder.encode(value)

export const bytesToUtf8 = (value: Uint8Array) => decoder.decode(value)

export const base64UrlEncode = (value: Uint8Array) =>
  base64urlnopad.encode(value)

export const base64UrlDecode = (
  value: string
): Effect.Effect<Uint8Array, PrivateCryptoInvalidBase64UrlError> =>
  Effect.try({
    try: () => base64urlnopad.decode(value),
    catch: () => new PrivateCryptoInvalidBase64UrlError({ value }),
  })

export const normalizeSecretBytes = (
  secret: string
): Effect.Effect<
  Uint8Array,
  PrivateCryptoInvalidBase64UrlError | PrivateCryptoInvalidBase64Error
> => {
  if (secret.startsWith('base64url:')) {
    return base64UrlDecode(secret.slice('base64url:'.length))
  }

  if (secret.startsWith('base64:')) {
    return base64Decode(secret.slice('base64:'.length))
  }

  return Effect.succeed(utf8ToBytes(secret))
}

const base64Decode = (value: string) =>
  Effect.try({
    try: () => base64.decode(value),
    catch: () => new PrivateCryptoInvalidBase64Error({ value }),
  })
