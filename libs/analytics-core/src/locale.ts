export const defaultLocale = 'en' as const

export type Locale = string

export const locales: readonly Locale[] = [defaultLocale]

export const isLocale = (value: string | undefined): value is Locale =>
  typeof value === 'string' && value.length > 0
