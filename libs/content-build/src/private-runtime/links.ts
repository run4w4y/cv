import {
  type Locale,
  localeSchema,
  type ProfileSlug,
  profileSlugSchema,
  resolveWebBaseUrl,
  type WebBaseUrl,
  webPathSegments,
} from '@cv/content-core'
import {
  type ContentEncryptionKey,
  deriveProfileContentKey,
  type PrivateCryptoError,
  parseRedactedPrivateContentRootKey,
  type WebCryptoApi,
} from '@cv/private-content-crypto'
import {
  encodePrivateAudienceId,
  mintPrivateCapabilityToken,
  type PrivateAudienceCodecFailure,
  parseRedactedPrivateAudienceCodecKey,
} from '@cv/private-content-tokens'
import { Effect, Schema } from 'effect'
import type * as Redacted from 'effect/Redacted'
import type { PrivateContentBuildSecrets } from '../config'
import { ContentBuildUsageError } from '../errors'
import { mangleProfileId } from '../ids'

export type MintPrivateAudienceLinkFromSecretsOptions = {
  audience: string
  audienceKey: Redacted.Redacted<string>
  baseUrl?: WebBaseUrl
  contentIdSalt: string
  locale: string
  profile: string
  secrets: PrivateContentBuildSecrets
}

export type MintedPrivateAudienceLink = {
  audience: string
  audienceId: string
  locale: Locale
  profile: ProfileSlug
  profileId: string
  token: string
  url: string
}

export type MintPrivateAudienceLinkError =
  | PrivateAudienceCodecFailure
  | PrivateCryptoError
  | ContentBuildUsageError

export const privateAudienceLinkUrl = ({
  audienceId,
  baseUrl,
  locale,
  token,
}: {
  audienceId: string
  baseUrl?: WebBaseUrl
  locale: Locale
  token: string
}) => {
  const path = `${webPathSegments(locale, 'a', audienceId)}/`
  const parameters = new URLSearchParams({ p: token }).toString()
  const url = `/${path}?${parameters}`

  if (!baseUrl) {
    return url
  }

  const deployed = resolveWebBaseUrl(baseUrl, path)
  deployed.searchParams.set('p', token)
  return deployed.href
}

const mintPrivateAudienceLinkForProfile = ({
  audience,
  audienceKey,
  baseUrl,
  contentKey,
  locale,
  profile,
  profileId,
}: {
  audience: string
  audienceKey: Redacted.Redacted<string>
  baseUrl?: WebBaseUrl
  contentKey: ContentEncryptionKey
  locale: Locale
  profile: ProfileSlug
  profileId: string
}): Effect.Effect<
  MintedPrivateAudienceLink,
  MintPrivateAudienceLinkError,
  WebCryptoApi
> =>
  Effect.gen(function* () {
    const audienceCodecKey =
      yield* parseRedactedPrivateAudienceCodecKey(audienceKey)
    const audienceId = yield* encodePrivateAudienceId({
      audience,
      key: audienceCodecKey,
    })
    const token = yield* mintPrivateCapabilityToken({
      profileContentKey: contentKey,
    })

    return {
      audience,
      audienceId,
      locale,
      profile,
      profileId,
      token,
      url: privateAudienceLinkUrl({
        audienceId,
        baseUrl,
        locale,
        token,
      }),
    } satisfies MintedPrivateAudienceLink
  })

export const mintPrivateAudienceLinkFromSecrets = ({
  audience,
  audienceKey,
  baseUrl,
  contentIdSalt,
  locale,
  profile,
  secrets,
}: MintPrivateAudienceLinkFromSecretsOptions): Effect.Effect<
  MintedPrivateAudienceLink,
  MintPrivateAudienceLinkError,
  WebCryptoApi
> =>
  Effect.gen(function* () {
    const decodedLocale = yield* Schema.decodeUnknownEffect(localeSchema)(
      locale
    ).pipe(
      Effect.mapError(
        () =>
          new ContentBuildUsageError({
            message: `Invalid private content locale "${locale}".`,
          })
      )
    )
    const decodedProfile = yield* Schema.decodeUnknownEffect(profileSlugSchema)(
      profile
    ).pipe(
      Effect.mapError(
        () =>
          new ContentBuildUsageError({
            message: `Invalid private content profile "${profile}".`,
          })
      )
    )
    const profileId = mangleProfileId(decodedProfile, contentIdSalt)
    const rootKey = yield* parseRedactedPrivateContentRootKey(secrets.rootKey)
    const contentKey = yield* deriveProfileContentKey({ profileId, rootKey })

    return yield* mintPrivateAudienceLinkForProfile({
      audience,
      audienceKey,
      baseUrl,
      contentKey,
      locale: decodedLocale,
      profile: decodedProfile,
      profileId,
    })
  })
