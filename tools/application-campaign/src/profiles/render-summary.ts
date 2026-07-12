import type { ProfileCatalog } from './catalog'
import {
  layeredProfileContent,
  profileSummaryCharacterBudget,
  renderJsonSummaryMarkdown,
  renderProfileLayer,
  selectProfileSummaryLayer,
} from './render-shared'

const renderProfileSummary = ({
  content,
  profile,
}: {
  readonly content: Exclude<
    ProfileCatalog['content'][string][string],
    undefined
  >
  readonly profile: string
}) => {
  const heading = `## ${profile}`
  const separator = '\n\n'
  const contextBudget = Math.max(
    0,
    profileSummaryCharacterBudget - heading.length - separator.length
  )
  const layered = layeredProfileContent(content)
  const layer = layered
    ? selectProfileSummaryLayer(layered, profile)
    : undefined

  return [
    heading,
    layered && layer
      ? renderProfileLayer(layer, {
          headingLevel: 3,
          renderedCharacterBudget: contextBudget,
        })
      : renderJsonSummaryMarkdown(content, contextBudget),
  ].join(separator)
}

export const renderProfileSummariesMarkdown = ({
  catalog,
  locale,
  profiles,
}: {
  readonly catalog: ProfileCatalog
  readonly locale: string
  readonly profiles: readonly string[]
}) =>
  profiles
    .map((profile) => {
      const content = catalog.content[locale]?.[profile]

      return content !== undefined
        ? renderProfileSummary({ content, profile })
        : `## ${profile}\n\nNo ${locale} content is available for this profile.`
    })
    .join('\n\n')
