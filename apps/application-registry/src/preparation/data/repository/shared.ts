import { Cause, type Crypto, Effect, type Schema } from 'effect'
import { PreparationDataError } from '../types'

const messageFromUnknown = (cause: unknown): string =>
  Cause.prettyErrors(Cause.fail(cause))[0]?.message ?? String(cause)

export const asPreparationDataError = (
  operation: string,
  cause: unknown
): PreparationDataError =>
  cause instanceof PreparationDataError
    ? cause
    : new PreparationDataError({
        message: messageFromUnknown(cause),
        operation,
      })

export const dataError = (operation: string) =>
  Effect.mapError((cause: unknown) => asPreparationDataError(operation, cause))

export const decodeOpaqueValue = (
  operation: string,
  payload: Uint8Array,
  mediaType: string
): Effect.Effect<Schema.Json, PreparationDataError> =>
  Effect.try({
    try: () => {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(payload)
      return mediaType.includes('json')
        ? (JSON.parse(text) as Schema.Json)
        : text
    },
    catch: (cause) => asPreparationDataError(operation, cause),
  })

export const encodeOpaqueText = (value: string): Uint8Array =>
  new TextEncoder().encode(value)

export const encodeOpaqueJson = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value))

export const sha256Hex = Effect.fn('PreparationRepository.sha256Hex')(
  function* (crypto: Crypto.Crypto, bytes: Uint8Array) {
    const digest = yield* crypto.digest('SHA-256', bytes)
    return Array.from(digest, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
  }
)
