import type {
  ContentRepository,
  ContentSourceReader,
} from '@cv/content-composer'
import type { Locale, ProfileSlug } from '@cv/content-core'

export type CvContentProfileEntry = {
  locale: Locale
  profile: ProfileSlug
}

export const compareProfiles = (left: ProfileSlug, right: ProfileSlug) =>
  left === 'default' ? -1 : right === 'default' ? 1 : left.localeCompare(right)

const compareEntries = (
  left: CvContentProfileEntry,
  right: CvContentProfileEntry
) => {
  const localeOrder = left.locale.localeCompare(right.locale)

  return localeOrder === 0
    ? compareProfiles(left.profile, right.profile)
    : localeOrder
}

export const discoverContentEntries = (repository: ContentRepository) => {
  const entries: CvContentProfileEntry[] = []

  for (const locale of repository.config.locales) {
    for (const profile of repository.profiles) {
      if (!repository.getEffectiveSection(locale, profile, ['profile'])) {
        continue
      }

      entries.push({
        locale,
        profile,
      })
    }
  }

  return entries.sort(compareEntries)
}

export const loadProfileManifest = (
  locale: Locale,
  profile: ProfileSlug,
  sources: ContentSourceReader,
  repository: ContentRepository
) => {
  const section = repository.getSourceSection(locale, profile, ['profile'])

  if (!section) {
    return null
  }

  const source = sources.readModule(section, `${profile}/${locale}/profile`)

  return {
    data: source.data,
    relativePath: source.relativePath,
  }
}
