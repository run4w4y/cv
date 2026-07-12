import { uniq } from 'es-toolkit'

export type ProfileCatalogIndex = {
  readonly availableProfiles: Readonly<Record<string, readonly string[]>>
  readonly defaultLocale: string
  readonly defaultProfile: string
  readonly locales: readonly string[]
  readonly profiles: readonly string[]
}

export type ProfileCatalog = ProfileCatalogIndex & {
  readonly content: Readonly<
    Record<string, Readonly<Partial<Record<string, unknown>>>>
  >
}

export const profileSlugsWithContent = (catalog: ProfileCatalogIndex) =>
  catalog.profiles.filter((profile) =>
    catalog.locales.some((locale) =>
      catalog.availableProfiles[locale]?.includes(profile)
    )
  )

export const profileSlugsForLocale = (
  catalog: ProfileCatalogIndex,
  locale = catalog.defaultLocale
) => {
  const available = new Set(catalog.availableProfiles[locale] ?? [])

  return catalog.profiles.filter((profile) => available.has(profile))
}

export const excludeProfileSlugs = (
  profiles: readonly string[],
  excludedProfiles: readonly string[]
) => {
  const excluded = new Set(excludedProfiles)

  return profiles.filter((profile) => !excluded.has(profile))
}

export const uniqueProfileSlugs = (profiles: readonly string[]) =>
  uniq(profiles)
