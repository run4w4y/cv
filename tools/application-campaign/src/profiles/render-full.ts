import type { CvContent } from '@cv/cv/content-model'
import { Effect } from 'effect'
import {
  fields,
  joinBlocks,
  type ProfileRenderContext,
  renderSection,
  textValue,
} from './render-shared'
import type { ResolvedProfileCatalog } from './variables'

const renderContactSection = (
  context: ProfileRenderContext,
  content: CvContent
) =>
  Effect.gen(function* () {
    const links = [...content.contact.contact, ...content.contact.social]
    const renderedLinks = yield* Effect.forEach(links, (link) =>
      textValue(context, link.value).pipe(
        Effect.map((value) => {
          const href =
            link.href && link.href !== value && link.href !== `mailto:${value}`
              ? link.href
              : undefined

          return fields([[link.label, href ? `${value} (${href})` : value]])
        })
      )
    )

    return renderedLinks.length > 0
      ? joinBlocks(['## Contact', renderedLinks.join('\n')])
      : undefined
  })

const renderProfileMarkdown = ({
  content,
  ...context
}: ProfileRenderContext & {
  readonly content: CvContent
}) =>
  Effect.gen(function* () {
    const name = yield* textValue(context, content.identity.name)
    const contact = yield* renderContactSection(context, content)
    const sections = yield* Effect.forEach(content.sections, (section) =>
      renderSection(context, section)
    )
    const markdown = joinBlocks([
      `# Profile: ${context.profile}`,
      fields([
        ['Label', content.profile.label],
        ['Locale', content.profile.locale],
        ['Target role', content.profile.targetRole],
        ['Headline', content.profile.headline],
        ['Profile summary', content.profile.summary],
        ['Last updated', content.profile.lastUpdated],
      ]),
      '## Identity',
      fields([
        ['Name', name],
        ['Role', content.identity.role],
        ['Headline', content.identity.headline],
        ['Summary', content.identity.summary],
        ['Location', content.identity.location],
        ['Timezone', content.identity.timezone],
      ]),
      contact,
      joinBlocks(sections),
    ])

    return markdown
  })

export const renderProfilesMarkdown = ({
  catalog,
  locale,
  profiles,
}: {
  readonly catalog: ResolvedProfileCatalog
  readonly locale: string
  readonly profiles: readonly string[]
}) =>
  Effect.forEach(profiles, (profile) => {
    const content = catalog.content[locale]?.[profile]

    return content
      ? renderProfileMarkdown({
          catalog,
          content,
          locale,
          profile,
        })
      : Effect.succeed(
          `# Profile: ${profile}\n\nNo ${locale} content is available for this profile.`
        )
  }).pipe(Effect.map((items) => items.join('\n\n---\n\n')))
