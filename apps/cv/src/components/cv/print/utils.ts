import type { LinkItem, SkillGroup } from '@/cv-content/model'

export const contactHref = (contact: readonly LinkItem[], label: string) =>
  contact.find((item) => item.label.toLowerCase() === label.toLowerCase())?.href

export const stackText = (items: readonly string[]) => items.join(', ')

export const skillText = (skill: SkillGroup) => {
  const subgroups =
    skill.subgroups
      ?.map((subgroup) => `${subgroup.group}: ${stackText(subgroup.items)}`)
      .join('; ') ?? ''
  const items = skill.items ? stackText(skill.items) : ''

  return [subgroups, items].filter(Boolean).join('; ')
}
