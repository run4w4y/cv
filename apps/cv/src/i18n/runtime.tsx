import {
  type I18n,
  type MessageDescriptor,
  type Messages,
  setupI18n,
} from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import { messages as enMessages } from '@/i18n/locales/en/messages.po'
import { messages as ruMessages } from '@/i18n/locales/ru/messages.po'
import type { Locale } from '@/lib/i18n'

type CvI18nProviderProps = {
  children: ReactNode
  locale: Locale
}

const catalogs = {
  en: enMessages,
  ru: ruMessages,
} satisfies Record<string, Messages>

type CatalogLocale = keyof typeof catalogs

const fallbackCatalogLocale: CatalogLocale = 'en'

const instances = new Map<CatalogLocale, I18n>()

const isCatalogLocale = (locale: Locale): locale is CatalogLocale =>
  locale in catalogs

const catalogLocale = (locale: Locale): CatalogLocale =>
  isCatalogLocale(locale) ? locale : fallbackCatalogLocale

export const getCvI18n = (locale: Locale) => {
  const activeLocale = catalogLocale(locale)
  const cached = instances.get(activeLocale)

  if (cached) {
    return cached
  }

  const instance = setupI18n()
  instance.loadAndActivate({
    locale: activeLocale,
    messages: catalogs[activeLocale],
  })
  instances.set(activeLocale, instance)

  return instance
}

export const translateCvMessage = (
  locale: Locale,
  descriptor: MessageDescriptor
) => getCvI18n(locale)._(descriptor)

export const CvLinguiProvider = ({ children, locale }: CvI18nProviderProps) => (
  <I18nProvider i18n={getCvI18n(locale)}>{children}</I18nProvider>
)
