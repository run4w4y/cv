import type { OpaquePayloadRequest } from '@cv/application-registry-api-contract'
import { RegistryBadRequestError } from '@cv/application-registry-service'
import { Effect } from 'effect'

const byteChunkSize = 32_768

export const decodeBase64 = (data: string) =>
  Effect.try({
    try: () => {
      const binary = atob(data)
      return Uint8Array.from(binary, (character) => character.charCodeAt(0))
    },
    catch: () =>
      new RegistryBadRequestError({
        message: 'Opaque payload data is not valid base64.',
      }),
  })

export const decodeOpaquePayload = (payload: OpaquePayloadRequest) =>
  decodeBase64(payload.data).pipe(
    Effect.map((bytes) => ({ bytes, mediaType: payload.mediaType }))
  )

export const encodeBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.byteLength; offset += byteChunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + byteChunkSize)
    )
  }
  return btoa(binary)
}
