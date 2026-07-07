import type { ProfileSlug } from '@cv/content-core'
import { Context } from 'effect'
import type { Locale } from '@/lib/i18n'
import {
  defaultLocale,
  isLocale,
  localePath,
  locales,
  privateAudiencePath,
} from '@/lib/i18n'

export type CvPageContextValue = {
  readonly audience?: string
  readonly contentProfile?: ProfileSlug
  readonly locale: Locale
  readonly localeHrefs: Partial<Record<Locale, string>>
  readonly profile: ProfileSlug
  readonly profileId?: string
  readonly webUrl?: string
}

export class CvPageContext extends Context.Service<
  CvPageContext,
  CvPageContextValue
>()('@cv/cv/CvPageContext') {}

const htmlDataset = () => {
  if (typeof document === 'undefined') {
    return {}
  }

  return document.documentElement.dataset
}

const optionalDatasetValue = (value: string | undefined) =>
  value && value.length > 0 ? value : undefined

const hashValue = (name: string) => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return new URLSearchParams(window.location.hash.replace(/^#/u, ''))
    .get(name)
    ?.trim()
}

const pathAudience = () => {
  if (typeof window === 'undefined') {
    return undefined
  }

  const match = window.location.pathname.match(
    /^\/(?<locale>[^/]+)\/a\/(?<audience>[^/]+)\/?$/u
  )
  const audience = match?.groups?.audience

  if (!audience) {
    return undefined
  }

  try {
    return decodeURIComponent(audience)
  } catch {
    return audience
  }
}

const currentPrivateWebUrl = (audience: string | undefined) => {
  if (typeof window === 'undefined' || !audience) {
    return undefined
  }

  const url = new URL(window.location.href)
  url.pathname = privateAudiencePath(
    isLocale(url.pathname.split('/')[1])
      ? url.pathname.split('/')[1]
      : defaultLocale,
    audience
  )
  url.searchParams.delete('p')
  url.searchParams.delete('aud')
  url.hash = ''

  return url.toString()
}

export const readCvPageContext = (): CvPageContextValue => {
  const dataset = htmlDataset()
  const locale = isLocale(dataset.cvLocale) ? dataset.cvLocale : defaultLocale
  const audience =
    optionalDatasetValue(pathAudience()) ??
    optionalDatasetValue(hashValue('audience')) ??
    optionalDatasetValue(dataset.cvAudience)
  const contentProfile = optionalDatasetValue(dataset.cvContentProfile)
  const profile = optionalDatasetValue(dataset.cvProfile) ?? 'default'
  const profileId = optionalDatasetValue(dataset.cvProfileId)
  const localeHrefs = Object.fromEntries(
    locales.map((hrefLocale) => [
      hrefLocale,
      audience
        ? privateAudiencePath(hrefLocale, audience)
        : localePath(hrefLocale),
    ])
  ) as Partial<Record<Locale, string>>

  return {
    audience,
    contentProfile,
    locale,
    localeHrefs,
    profile,
    profileId,
    webUrl:
      currentPrivateWebUrl(audience) ?? optionalDatasetValue(dataset.cvWebUrl),
  }
}
