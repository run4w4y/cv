import {
  encryptAesGcmPayload,
  type PrivateCryptoError,
  privateProfileSelectorFromContentKey,
  utf8ToBytes,
  type WebCryptoApi,
} from '@cv/private-content-crypto'
import { Effect, type Crypto as PlatformCrypto } from 'effect'
import { PrivateRuntimeManifestError } from '../errors'
import { PRIVATE_RUNTIME_SCHEMA } from '../schema'
import type {
  PrivateRuntimeBuildInput,
  PrivateRuntimeManifest,
  PrivateRuntimeProfilePayload,
} from '../types'
import { runtimeProfileAad } from './aad'
import {
  compressPrivateRuntimePayload,
  privateRuntimePayloadCompression,
} from './compression'

export const emptyPrivateRuntimeManifest = () =>
  ({
    generatedAt: new Date().toISOString(),
    profiles: [],
    schema: PRIVATE_RUNTIME_SCHEMA,
    version: 1,
  }) satisfies PrivateRuntimeManifest

const buildRuntimeProfile = (
  profile: PrivateRuntimeBuildInput['profiles'][number]
): Effect.Effect<
  PrivateRuntimeManifest['profiles'][number],
  PrivateRuntimeManifestError | PrivateCryptoError,
  WebCryptoApi | PlatformCrypto.Crypto
> =>
  Effect.all({
    payloadBytes: compressPrivateRuntimePayload(
      utf8ToBytes(
        JSON.stringify({
          content: profile.content,
          locale: profile.locale,
          variables: profile.variables,
        } satisfies PrivateRuntimeProfilePayload)
      )
    ),
    selector: privateProfileSelectorFromContentKey(profile.contentKey),
  }).pipe(
    Effect.flatMap(({ payloadBytes, selector }) =>
      encryptAesGcmPayload(
        profile.contentKey,
        payloadBytes,
        runtimeProfileAad(profile.id, profile.locale)
      ).pipe(
        Effect.map((payload) => ({
          id: profile.id,
          locale: profile.locale,
          payload: {
            ...payload,
            compression: privateRuntimePayloadCompression,
          },
          profile: profile.profile,
          selector,
        }))
      )
    )
  )

const assertUniqueProfileSelectors = (
  profiles: readonly PrivateRuntimeManifest['profiles'][number][]
): Effect.Effect<void, PrivateRuntimeManifestError> => {
  const seen = new Map<string, PrivateRuntimeManifest['profiles'][number]>()

  for (const profile of profiles) {
    const key = `${profile.locale}\0${profile.selector}`
    const existing = seen.get(key)

    if (existing) {
      return Effect.fail(
        new PrivateRuntimeManifestError({
          message: `Private runtime profile selector collision for ${profile.locale}/${profile.selector}: ${existing.profile} and ${profile.profile}`,
        })
      )
    }

    seen.set(key, profile)
  }

  return Effect.void
}

export const buildPrivateRuntimeManifest = (
  source: PrivateRuntimeBuildInput
): Effect.Effect<
  PrivateRuntimeManifest,
  PrivateRuntimeManifestError | PrivateCryptoError,
  WebCryptoApi | PlatformCrypto.Crypto
> => {
  return Effect.all({
    generatedAt: Effect.sync(() => new Date().toISOString()),
    profiles: Effect.forEach(source.profiles, buildRuntimeProfile),
  }).pipe(
    Effect.flatMap(({ generatedAt, profiles }) =>
      assertUniqueProfileSelectors(profiles).pipe(
        Effect.as({ generatedAt, profiles })
      )
    ),
    Effect.map(
      ({ generatedAt, profiles }) =>
        ({
          generatedAt,
          profiles,
          schema: PRIVATE_RUNTIME_SCHEMA,
          version: 1,
        }) satisfies PrivateRuntimeManifest
    )
  )
}
