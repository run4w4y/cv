import type { ProfileCatalog } from './catalog'
import {
  type AuthoredSharedSource,
  layeredProfileContent,
  renderJsonMarkdown,
  renderProfileLayer,
  renderSharedSources,
} from './render-shared'

const renderProfileMarkdown = ({
  content,
  profile,
}: {
  readonly content: Exclude<
    ProfileCatalog['content'][string][string],
    undefined
  >
  readonly profile: string
}) => {
  const layered = layeredProfileContent(content)

  return [
    `# Profile: ${profile}`,
    layered
      ? layered.layers.map((layer) => renderProfileLayer(layer)).join('\n\n')
      : renderJsonMarkdown(content),
  ].join('\n\n')
}

const sharedSourcesForProfiles = ({
  catalog,
  locale,
  profiles,
}: {
  readonly catalog: ProfileCatalog
  readonly locale: string
  readonly profiles: readonly string[]
}) => {
  const sources = new Map<string, AuthoredSharedSource>()

  for (const profile of profiles) {
    const layered = layeredProfileContent(catalog.content[locale]?.[profile])

    for (const source of layered?.sharedSources ?? []) {
      sources.set(`${source.modulePath}\u0000${source.source}`, source)
    }
  }

  return [...sources.values()]
}

export const renderProfilesMarkdown = ({
  catalog,
  locale,
  profiles,
}: {
  readonly catalog: ProfileCatalog
  readonly locale: string
  readonly profiles: readonly string[]
}) => {
  const sharedSources = sharedSourcesForProfiles({ catalog, locale, profiles })
  const sharedContext =
    sharedSources.length > 0
      ? [
          '# Shared authored sources',
          'These repository-wide definitions are referenced by the profile layers below.',
          renderSharedSources(sharedSources),
        ].join('\n\n')
      : undefined
  const profileContexts = profiles
    .map((profile) => {
      const content = catalog.content[locale]?.[profile]

      return content !== undefined
        ? renderProfileMarkdown({ content, profile })
        : `# Profile: ${profile}\n\nNo ${locale} content is available for this profile.`
    })
    .join('\n\n---\n\n')

  return [sharedContext, profileContexts]
    .filter((block): block is string => block !== undefined)
    .join('\n\n---\n\n')
}
