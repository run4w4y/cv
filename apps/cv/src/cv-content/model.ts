import type { CvContent, NavSection, TextLink } from './schema/content'

export type * from './schema/content'

export type LinkItem = TextLink

export const navSectionHref = (section: NavSection) => `#${section}`

export const cvSectionByType = <
  Type extends CvContent['sections'][number]['type'],
>(
  content: CvContent,
  type: Type
) => {
  const section = content.sections.find((item) => item.type === type)

  if (!section) {
    throw new Error(`Missing CV section ${type}`)
  }

  return section as Extract<CvContent['sections'][number], { type: Type }>
}

export const cvSectionById = (content: CvContent, id: string) => {
  const section = content.sections.find((item) => item.id === id)

  if (!section) {
    throw new Error(`Missing CV section ${id}`)
  }

  return section
}

export const navSectionLabel = (content: CvContent, section: NavSection) =>
  cvSectionById(content, section).label
