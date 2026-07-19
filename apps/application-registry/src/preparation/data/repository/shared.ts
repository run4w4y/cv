import type { OpaquePayloadResponse } from '@cv/application-registry-api-contract'
import { Effect } from 'effect'

import {
  decodeJsonBase64,
  decodeUtf8Base64,
  encodeUtf8Base64,
} from '../../base64'
import { PreparationDataError } from '../types'

const messageFromUnknown = (cause: unknown): string => {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof cause.message === 'string'
  ) {
    return cause.message
  }
  return String(cause)
}

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
  payload: OpaquePayloadResponse
): Effect.Effect<unknown, PreparationDataError> =>
  Effect.try({
    try: () =>
      payload.mediaType.includes('json')
        ? decodeJsonBase64(payload.data)
        : decodeUtf8Base64(payload.data),
    catch: (cause) => asPreparationDataError(operation, cause),
  })

export const encodeOpaqueText = (
  operation: string,
  value: string
): Effect.Effect<string, PreparationDataError> =>
  Effect.try({
    try: () => encodeUtf8Base64(value),
    catch: (cause) => asPreparationDataError(operation, cause),
  })
