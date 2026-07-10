import type { Locale } from '@cv/content-core'
import { getCvWebConfig } from './config'

const localePath = (locale: Locale) => `/${locale}/`

export const getWebCvBaseUrl = () => getCvWebConfig().webBaseUrl

const webUrlFromBase = (baseUrl: string, path: string) =>
  new URL(path.replace(/^\/+/u, ''), baseUrl).toString()

const privateAudienceUrlFromBase = ({
  audienceId,
  baseUrl,
  locale,
  token,
}: {
  readonly audienceId: string
  readonly baseUrl?: string
  readonly locale: Locale
  readonly token?: string
}) => {
  const path = `/${locale}/a/${encodeURIComponent(audienceId)}/`
  const relativeUrl = token
    ? `${path}?${new URLSearchParams({ p: token }).toString()}`
    : path

  return baseUrl ? webUrlFromBase(baseUrl, relativeUrl) : relativeUrl
}

export const getWebCvAssetUrl = (path: string) =>
  webUrlFromBase(getWebCvBaseUrl(), path)

export const getWebCvUrl = (locale: Locale) =>
  webUrlFromBase(getWebCvBaseUrl(), localePath(locale))

export const getPrivateAudienceCvUrlFromBase = (
  baseUrl: string,
  locale: Locale,
  audienceId: string,
  token?: string
) => {
  return privateAudienceUrlFromBase({
    audienceId,
    baseUrl,
    locale,
    token,
  })
}

export const getPrivateAudienceCvUrl = (
  locale: Locale,
  audienceId: string,
  token?: string
) =>
  getPrivateAudienceCvUrlFromBase(getWebCvBaseUrl(), locale, audienceId, token)
