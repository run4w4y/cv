import type { ContentComposeContext } from '@cv/content-composer'
import { cloneValue } from '@cv/content-composer'
import type { Locale, ProfileSlug } from '@cv/content-core'
import type { CvContent } from '../model'
import * as CvSchema from '../schema/registry'
import { createContentContext } from './context'
import { compareProfiles, discoverContentEntries } from './discovery'
import { finalizeContent, loadProfile } from './profile'

export const composeCvAppContent = (
  composeContext: ContentComposeContext
): {
  manifest: {
    content: Record<Locale, Partial<Record<ProfileSlug, CvContent>>>
    locales: readonly Locale[]
    profiles: readonly ProfileSlug[]
  }
} => {
  const context = createContentContext(composeContext)
  const entries = discoverContentEntries(context.repository)
  const locales = [...context.repository.config.locales]
  const profiles = [...context.repository.profiles].sort(compareProfiles)
  const content: Record<Locale, Partial<Record<ProfileSlug, CvContent>>> = {}

  if (entries.length === 0) {
    throw new Error(
      'No CV content profiles were discovered. Expected content/profiles/<profile>/<locale>/ sections.'
    )
  }

  for (const { locale, profile } of entries) {
    content[locale] ??= {}
    const profileContent = finalizeContent(
      cloneValue(loadProfile(locale, profile, context))
    )

    content[locale][profile] = CvSchema.decodeCvContentSchema(
      CvSchema.cvContentSchema,
      profileContent,
      `${profile}/${locale}`
    )
  }

  return {
    manifest: {
      content,
      locales,
      profiles,
    },
  }
}
