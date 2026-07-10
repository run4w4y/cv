import type { SkillGroup } from '@/cv-content/model'

export const stackText = (items: readonly string[]) => items.join(', ')

export const skillText = (skill: SkillGroup) => {
  const subgroups =
    skill.subgroups
      ?.map((subgroup) => `${subgroup.group}: ${stackText(subgroup.items)}`)
      .join('; ') ?? ''
  const items = skill.items ? stackText(skill.items) : ''

  return [subgroups, items].filter(Boolean).join('; ')
}
