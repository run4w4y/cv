import type { Locale } from '@cv/content-core'
import { getCvWebConfig } from './config'

const localePath = (locale: Locale) => `/${locale}/`

const privateAudiencePath = (locale: Locale, audienceId: string) =>
  `/${locale}/a/${encodeURIComponent(audienceId)}/`

export const getWebCvBaseUrl = () => getCvWebConfig().webBaseUrl

const toSiteRelativeUrl = (path: string) => path.replace(/^\/+/, '')

export const getWebCvAssetUrl = (path: string) =>
  new URL(toSiteRelativeUrl(path), getWebCvBaseUrl()).toString()

export const getWebCvUrl = (locale: Locale) =>
  new URL(toSiteRelativeUrl(localePath(locale)), getWebCvBaseUrl()).toString()

export const getPrivateAudienceCvUrl = (
  locale: Locale,
  audienceId: string,
  token?: string
) => {
  const url = new URL(
    toSiteRelativeUrl(privateAudiencePath(locale, audienceId)),
    getWebCvBaseUrl()
  )

  if (token) {
    url.searchParams.set('p', token)
  }

  return url.toString()
}
