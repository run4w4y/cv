import {
  bytesToUtf8,
  type ContentEncryptionKey,
  decryptAesGcmPayload,
  type EncryptedPayload,
  type PrivateCryptoError,
  type WebCryptoApi,
} from '@cv/private-content-crypto'
import { Effect, Schema } from 'effect'
import { PrivateRuntimeManifestError } from '../errors'
import { privateRuntimeProfilePayloadSchema } from '../schema'
import type {
  OpenedPrivateRuntimeProfile,
  PrivateRuntimeProfile,
  PrivateRuntimeProfilePayload,
} from '../types'
import { runtimeProfileAad } from './aad'
import {
  decompressPrivateRuntimePayload,
  type PrivateRuntimePayloadCompression,
} from './compression'

const decryptJson = <Payload>(
  key: ContentEncryptionKey,
  payload: EncryptedPayload & { compression: PrivateRuntimePayloadCompression },
  associatedData: Uint8Array,
  decodePayload: (value: unknown) => Effect.Effect<Payload, unknown, never>
): Effect.Effect<
  Payload,
  PrivateCryptoError | PrivateRuntimeManifestError,
  WebCryptoApi
> =>
  decryptAesGcmPayload(key, payload, associatedData).pipe(
    Effect.flatMap((bytes) =>
      decompressPrivateRuntimePayload(bytes, payload.compression)
    ),
    Effect.map(bytesToUtf8),
    Effect.flatMap((text) =>
      Effect.try({
        try: (): unknown => JSON.parse(text),
        catch: (cause) =>
          new PrivateRuntimeManifestError({
            cause,
            message: 'Could not parse private runtime payload',
          }),
      })
    ),
    Effect.flatMap((value) =>
      decodePayload(value).pipe(
        Effect.mapError(
          (cause) =>
            new PrivateRuntimeManifestError({
              cause,
              message: 'Private runtime payload failed schema validation',
            })
        )
      )
    )
  )

export const openRuntimeProfileEntry = (
  profile: PrivateRuntimeProfile,
  profileContentKey: ContentEncryptionKey
): Effect.Effect<
  OpenedPrivateRuntimeProfile,
  PrivateCryptoError | PrivateRuntimeManifestError,
  WebCryptoApi
> =>
  Effect.all({
    profile: decryptJson<PrivateRuntimeProfilePayload>(
      profileContentKey,
      profile.payload,
      runtimeProfileAad(profile.id, profile.locale),
      (value) =>
        Schema.decodeUnknownEffect(privateRuntimeProfilePayloadSchema, {
          errors: 'all',
        })(value)
    ),
  }).pipe(
    Effect.map(({ profile: profilePayload }) => ({
      profile: profilePayload,
      profileId: profile.id,
      profileSlug: profile.profile,
    }))
  )
