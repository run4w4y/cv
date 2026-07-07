import type { Locale, ProfileSlug } from '@cv/content-core'

export type ContentRepositoryConfig = {
  contentDir?: string
  locales: readonly Locale[]
  publicProfiles?: readonly ProfileSlug[]
}

export type ContentRepositoryOptions = {
  defaultLocale: Locale
  defaultProfile: ProfileSlug
}

export type ResolvedContentRepositoryConfig = {
  contentDir: string
  defaultLocale: Locale
  defaultProfile: ProfileSlug
  locales: readonly Locale[]
  publicProfiles: readonly ProfileSlug[]
}

export type ContentSectionKind = 'mdx' | 'module'

export type ContentSectionSource = {
  id: string
  kind: ContentSectionKind
  locale: Locale
  modulePath: string
  path: readonly string[]
  profile: ProfileSlug
  sourceProfile: ProfileSlug
}

export type ContentSectionLookup = (
  locale: Locale,
  profile: ProfileSlug,
  path: readonly string[]
) => ContentSectionSource | undefined

export type ContentRepository = {
  config: ResolvedContentRepositoryConfig
  getEffectiveSection: ContentSectionLookup
  getSourceSection: ContentSectionLookup
  listSourceChildren: (
    locale: Locale,
    profile: ProfileSlug,
    path: readonly string[]
  ) => readonly ContentSectionSource[]
  profiles: readonly ProfileSlug[]
}
