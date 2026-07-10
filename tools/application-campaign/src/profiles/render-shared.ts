import type {
  CvContent,
  ProfileBlock,
  RedactableText,
} from '@cv/cv/content-model'
import { Effect } from 'effect'
import { ApplicationCampaignContentError } from '../errors'
import type { ResolvedProfileCatalog } from './variables'

export type CvSection = CvContent['sections'][number]
type AboutSection = Extract<CvSection, { readonly type: 'profile' }>
type EducationSection = Extract<CvSection, { readonly type: 'education' }>
type ExperienceSection = Extract<CvSection, { readonly type: 'experience' }>
type ProjectsSection = Extract<CvSection, { readonly type: 'projects' }>
type SkillsSection = Extract<CvSection, { readonly type: 'skills' }>

export type MarkdownField = readonly [label: string, value: string | undefined]

export type ProfileRenderContext = {
  readonly catalog: ResolvedProfileCatalog
  readonly locale: string
  readonly profile: string
}

export const hasText = (value: string | undefined): value is string =>
  Boolean(value?.trim())

export const compact = (value: string | undefined) => value?.trim()

export const textValue = (
  context: ProfileRenderContext,
  value: RedactableText
): Effect.Effect<string, ApplicationCampaignContentError> => {
  if (typeof value === 'string') {
    return Effect.succeed(value)
  }

  const resolved = context.catalog.resolvedVariables.get(value.variable)

  return resolved === undefined
    ? Effect.fail(
        new ApplicationCampaignContentError({
          message: `Private content variable "${value.variable}" was not resolved for ${context.locale}.`,
        })
      )
    : Effect.succeed(resolved)
}

export const commaList = (
  items: readonly string[] | undefined,
  limit?: number
) => {
  const selected = limit ? items?.slice(0, limit) : items

  return selected && selected.length > 0 ? selected.join(', ') : undefined
}

export const bulletList = (items: readonly string[]) =>
  items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : undefined

export const fields = (items: readonly MarkdownField[]) =>
  items
    .flatMap(([label, value]) =>
      hasText(value) ? [`- ${label}: ${value}`] : []
    )
    .join('\n')

export const joinBlocks = (items: readonly (string | undefined)[]) =>
  items.filter(hasText).join('\n\n')

export const signalText = (items: readonly (string | undefined)[]) =>
  items.filter(hasText).join(' - ')

const renderProfileBlock = (
  context: ProfileRenderContext,
  block: ProfileBlock
): Effect.Effect<string, ApplicationCampaignContentError> => {
  switch (block.type) {
    case 'heading':
      return Effect.succeed(`### ${block.text}`)
    case 'title':
      return Effect.succeed(`#### ${block.text}`)
    case 'text':
      return Effect.succeed(block.text)
    case 'detail':
      return Effect.gen(function* () {
        const value = yield* textValue(context, block.value)
        const note = block.note ? ` (${block.note})` : ''
        const href = block.href ? ` ${block.href}` : ''

        return `- ${block.label}: ${value}${note}${href}`
      })
    case 'redacted':
      return Effect.gen(function* () {
        const items = yield* Effect.forEach(block.items, (item) =>
          renderProfileBlock(context, item)
        )
        const title = block.descriptor.title
          ? `### ${block.descriptor.title}`
          : undefined

        return joinBlocks([title, items.join('\n')])
      })
  }
}

const renderAboutSection = (
  context: ProfileRenderContext,
  section: AboutSection
) =>
  Effect.gen(function* () {
    const items = yield* Effect.forEach(section.items, (item) =>
      Effect.gen(function* () {
        const blocks = yield* Effect.forEach(item.blocks, (block) =>
          renderProfileBlock(context, block)
        )

        return joinBlocks(blocks)
      })
    )

    return joinBlocks([
      `## ${section.label}`,
      section.description,
      joinBlocks(items),
    ])
  })

const renderExperienceItem = (
  context: ProfileRenderContext,
  item: ExperienceSection['items'][number]
) =>
  Effect.gen(function* () {
    const company = yield* textValue(context, item.company)

    return joinBlocks([
      `### ${item.title} at ${company}`,
      fields([
        ['Period', item.period],
        ['Location', item.location],
        ['Stack', commaList(item.stack)],
      ]),
      item.summary,
      item.workstreams && item.workstreams.length > 0
        ? joinBlocks([
            'Workstreams:',
            bulletList(
              item.workstreams.map(
                (workstream) => `${workstream.title}: ${workstream.summary}`
              )
            ),
          ])
        : undefined,
      item.highlights.length > 0
        ? joinBlocks(['Highlights:', bulletList(item.highlights)])
        : undefined,
    ])
  })

const renderExperienceSection = (
  context: ProfileRenderContext,
  section: ExperienceSection
) =>
  Effect.gen(function* () {
    const items = yield* Effect.forEach(section.items, (item) =>
      renderExperienceItem(context, item)
    )

    return joinBlocks([
      `## ${section.label}`,
      section.description,
      joinBlocks(items),
    ])
  })

const renderProjectItem = (item: ProjectsSection['items'][number]) =>
  joinBlocks([
    `### ${item.name}`,
    fields([
      ['Visibility', item.visibility],
      ['Stack', commaList(item.stack)],
      [
        'Links',
        item.links.length > 0
          ? item.links.map((link) => `${link.label}: ${link.href}`).join('; ')
          : undefined,
      ],
    ]),
    item.summary,
  ])

const renderProjectsSection = (section: ProjectsSection) =>
  joinBlocks([
    `## ${section.label}`,
    section.description,
    joinBlocks(section.items.map(renderProjectItem)),
  ])

const renderSkillGroup = (group: SkillsSection['items'][number]) =>
  joinBlocks([
    `### ${group.group}`,
    group.items && group.items.length > 0
      ? bulletList([group.items.join(', ')])
      : undefined,
    group.subgroups && group.subgroups.length > 0
      ? bulletList(
          group.subgroups.map(
            (subgroup) => `${subgroup.group}: ${subgroup.items.join(', ')}`
          )
        )
      : undefined,
  ])

const renderSkillsSection = (section: SkillsSection) =>
  joinBlocks([
    `## ${section.label}`,
    section.description,
    section.printStack.length > 0
      ? joinBlocks(['Print stack:', bulletList(section.printStack)])
      : undefined,
    joinBlocks(section.items.map(renderSkillGroup)),
  ])

const renderEducationItem = (item: EducationSection['items'][number]) =>
  joinBlocks([
    `### ${item.degree}`,
    fields([
      ['Institution', item.institution],
      ['Period', item.period],
      ['Location', item.location],
    ]),
    item.details,
    item.thesis
      ? joinBlocks([
          `Thesis: ${item.thesis.title}`,
          item.thesis.summary,
          item.thesis.links.length > 0
            ? fields([
                [
                  'Links',
                  item.thesis.links
                    .map((link) => `${link.label}: ${link.href}`)
                    .join('; '),
                ],
              ])
            : undefined,
        ])
      : undefined,
  ])

const renderEducationSection = (section: EducationSection) =>
  joinBlocks([
    `## ${section.label}`,
    section.description,
    joinBlocks(section.items.map(renderEducationItem)),
  ])

export const renderSection = (
  context: ProfileRenderContext,
  section: CvSection
) => {
  switch (section.type) {
    case 'profile':
      return renderAboutSection(context, section)
    case 'experience':
      return renderExperienceSection(context, section)
    case 'projects':
      return Effect.succeed(renderProjectsSection(section))
    case 'skills':
      return Effect.succeed(renderSkillsSection(section))
    case 'education':
      return Effect.succeed(renderEducationSection(section))
  }
}
