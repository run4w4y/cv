import {
  defaultLocale as contentDefaultLocale,
  getLocales,
} from 'virtual:content/generated/runtime'
import type { Locale as ContentLocale } from '@cv/content-core'

export type Locale = ContentLocale

export const defaultLocale: Locale = contentDefaultLocale

const discoveredLocales = getLocales()

export const locales = discoveredLocales.includes(defaultLocale)
  ? discoveredLocales
  : [defaultLocale, ...discoveredLocales]

const preferredLocaleNames: Record<string, string> = {
  en: 'EN',
  ru: 'RU',
}

export const localeNames: Record<Locale, string> = Object.fromEntries(
  locales.map((locale) => [
    locale,
    preferredLocaleNames[locale] ?? locale.toUpperCase(),
  ])
)

export const isLocale = (value: string | undefined): value is Locale =>
  typeof value === 'string' && locales.includes(value)

export const localePath = (locale: Locale) => `/${locale}/`

export const privateAudiencePath = (locale: Locale, audienceId: string) =>
  `/${locale}/a/${encodeURIComponent(audienceId)}/`
