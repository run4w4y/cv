import {
  decodeWebBaseUrl,
  type Locale,
  resolveWebBaseUrl,
  webPathSegments,
} from '@cv/content-core'
import { getCvWebConfig } from './config'

const localePath = (locale: Locale) => `${webPathSegments(locale)}/`

export const getWebCvBaseUrl = () => getCvWebConfig().webBaseUrl.href

const webUrlFromBase = (baseUrl: string, path: string) =>
  resolveWebBaseUrl(decodeWebBaseUrl(baseUrl), path).href

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
  const path = `${webPathSegments(locale, 'a', audienceId)}/`
  const relativeUrl = token
    ? `${path}?${new URLSearchParams({ p: token }).toString()}`
    : path

  return baseUrl ? webUrlFromBase(baseUrl, relativeUrl) : relativeUrl
}

export const getWebCvAssetUrl = (path: string) =>
  resolveWebBaseUrl(getCvWebConfig().webBaseUrl, path).href

export const getWebCvUrl = (locale: Locale) =>
  resolveWebBaseUrl(getCvWebConfig().webBaseUrl, localePath(locale)).href

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
