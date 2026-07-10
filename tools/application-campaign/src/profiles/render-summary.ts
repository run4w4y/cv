import type { CvContent, ProfileBlock } from '@cv/cv/content-model'
import { Effect } from 'effect'
import type { ApplicationCampaignContentError } from '../errors'
import { truncateText } from '../text'
import {
  bulletList,
  type CvSection,
  commaList,
  compact,
  fields,
  joinBlocks,
  type ProfileRenderContext,
  signalText,
  textValue,
} from './render-shared'
import type { ResolvedProfileCatalog } from './variables'

const profileSummaryLength = 2_400

const profileBlockSignal = (
  context: ProfileRenderContext,
  block: ProfileBlock
): Effect.Effect<readonly string[], ApplicationCampaignContentError> => {
  switch (block.type) {
    case 'heading':
    case 'title':
    case 'text':
      return Effect.succeed([block.text])
    case 'detail':
      return textValue(context, block.value).pipe(
        Effect.map((value) => [`${block.label}: ${value}`])
      )
    case 'redacted':
      return Effect.forEach(block.items, (detail) =>
        textValue(context, detail.value).pipe(
          Effect.map((value) => `${detail.label}: ${value}`)
        )
      )
  }
}

const sectionSummarySignals = (
  context: ProfileRenderContext,
  section: CvSection
): Effect.Effect<readonly string[], ApplicationCampaignContentError> => {
  switch (section.type) {
    case 'profile':
      return Effect.gen(function* () {
        const signals = yield* Effect.forEach(section.items, (item) =>
          Effect.forEach(item.blocks, (block) =>
            profileBlockSignal(context, block)
          )
        )

        return signals.flat(2).slice(0, 8)
      })
    case 'experience':
      return Effect.forEach(section.items.slice(0, 4), (item) =>
        Effect.gen(function* () {
          const company = yield* textValue(context, item.company)
          const stack = commaList(item.stack, 10)

          return signalText([
            `${item.title} at ${company} (${item.period})`,
            compact(item.summary),
            item.highlights.length > 0
              ? `Highlights: ${item.highlights.slice(0, 3).join('; ')}`
              : undefined,
            stack ? `Stack: ${stack}` : undefined,
          ])
        })
      )
    case 'projects':
      return Effect.succeed(
        section.items
          .slice(0, 4)
          .map((item) =>
            signalText([
              item.name,
              compact(item.summary),
              commaList(item.stack, 8)
                ? `Stack: ${commaList(item.stack, 8)}`
                : undefined,
            ])
          )
      )
    case 'skills':
      return Effect.succeed(
        [
          ...section.printStack,
          ...section.items.flatMap((group) => [
            ...(group.items ?? []),
            ...(group.subgroups ?? []).flatMap((subgroup) => subgroup.items),
          ]),
        ].slice(0, 32)
      )
    case 'education':
      return Effect.succeed(
        section.items
          .slice(0, 2)
          .map((item) =>
            signalText([
              item.degree,
              item.institution,
              item.details,
              item.thesis?.summary,
            ])
          )
      )
  }
}

const renderSectionSummary = (
  context: ProfileRenderContext,
  section: CvSection
) =>
  Effect.gen(function* () {
    const signals = yield* sectionSummarySignals(context, section)

    return signals.length > 0
      ? joinBlocks([`${section.label} signals:`, bulletList(signals)])
      : undefined
  })

const renderProfileSummary = ({
  content,
  ...context
}: ProfileRenderContext & {
  readonly content: CvContent
}) =>
  Effect.gen(function* () {
    const name = yield* textValue(context, content.identity.name)
    const sectionSummaries = yield* Effect.forEach(
      content.sections,
      (section) => renderSectionSummary(context, section)
    )
    const markdown = truncateText(
      joinBlocks([
        `## ${context.profile}`,
        fields([
          ['Label', content.profile.label],
          ['Target role', content.profile.targetRole],
          ['Headline', content.profile.headline],
          ['Profile summary', content.profile.summary],
          ['Name', name],
          ['Current role', content.identity.role],
          ['Identity headline', content.identity.headline],
          ['Identity summary', content.identity.summary],
          ['Location', content.identity.location],
        ]),
        joinBlocks(sectionSummaries),
      ]),
      profileSummaryLength
    )

    return markdown
  })

export const renderProfileSummariesMarkdown = ({
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
      ? renderProfileSummary({
          catalog,
          content,
          locale,
          profile,
        })
      : Effect.succeed(
          `## ${profile}\n\nNo ${locale} content is available for this profile.`
        )
  }).pipe(Effect.map((items) => items.join('\n\n')))
