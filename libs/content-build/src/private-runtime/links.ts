import type { Locale, ProfileSlug } from '@cv/content-core'
import {
  type ContentEncryptionKey,
  deriveProfileContentKey,
  type PrivateCryptoError,
  parsePrivateContentRootKey,
  type WebCryptoApi,
} from '@cv/private-content-crypto'
import {
  encodePrivateAudienceId,
  mintPrivateCapabilityToken,
  type PrivateAudienceCodecFailure,
  parsePrivateAudienceCodecKey,
} from '@cv/private-content-tokens'
import { Effect } from 'effect'
import type { PrivateContentBuildSecrets } from '../config'
import { mangleProfileId } from '../ids'

export type MintPrivateAudienceLinkFromSecretsOptions = {
  audience: string
  audienceKey: string
  baseUrl?: string
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

export const privateAudienceLinkUrl = ({
  audienceId,
  baseUrl = '',
  locale,
  token,
}: {
  audienceId: string
  baseUrl?: string
  locale: string
  token: string
}) => {
  const url = new URL(
    `${baseUrl.replace(/\/+$/u, '') || 'http://localhost'}/${locale}/a/${encodeURIComponent(
      audienceId
    )}/`
  )

  url.searchParams.set('p', token)

  return baseUrl ? url.toString() : `${url.pathname}${url.search}`
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
  audienceKey: string
  baseUrl?: string
  contentKey: ContentEncryptionKey
  locale: string
  profile: string
  profileId: string
}): Effect.Effect<
  MintedPrivateAudienceLink,
  MintPrivateAudienceLinkError,
  WebCryptoApi
> =>
  Effect.gen(function* () {
    const audienceCodecKey = yield* parsePrivateAudienceCodecKey(audienceKey)
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
      locale: locale as Locale,
      profile: profile as ProfileSlug,
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
    const profileId = mangleProfileId(profile, contentIdSalt)
    const rootKey = yield* parsePrivateContentRootKey(secrets.rootKey)
    const contentKey = yield* deriveProfileContentKey({ profileId, rootKey })

    return yield* mintPrivateAudienceLinkForProfile({
      audience,
      audienceKey,
      baseUrl,
      contentKey,
      locale,
      profile,
      profileId,
    })
  })
