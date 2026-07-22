import type { FactsCatalogueV1, FactsSectionV1 } from '@cv/contracts/facts'

type FactsCatalogueCounts = {
  readonly assets: number
  readonly evidence: number
  readonly facts: number
  readonly sections: number
}

export const factsSectionLabels = {
  contact: 'Contact',
  education: 'Education',
  experience: 'Experience',
  identity: 'Identity',
  projects: 'Projects',
  skills: 'Skills',
} as const satisfies Record<FactsSectionV1['kind'], string>

const optionalFactCount = (value: unknown): number =>
  value === undefined ? 0 : 1

export const reviewedFactCount = (section: FactsSectionV1): number => {
  switch (section.kind) {
    case 'identity':
      return optionalFactCount(section.overview) + section.facts.length
    case 'contact':
      return 0
    case 'education':
      return section.entries.reduce(
        (total, entry) =>
          total +
          entry.details.length +
          optionalFactCount(entry.thesis?.summary),
        0
      )
    case 'experience':
      return section.entries.reduce(
        (total, entry) =>
          total +
          optionalFactCount(entry.overview) +
          entry.highlights.length +
          entry.workstreams.reduce(
            (workstreamTotal, workstream) =>
              workstreamTotal +
              optionalFactCount(workstream.overview) +
              workstream.contributions.length,
            0
          ),
        0
      )
    case 'projects':
      return section.entries.reduce(
        (total, entry) =>
          total +
          1 +
          entry.contributions.reduce(
            (contributionTotal, contribution) =>
              contributionTotal + contribution.facts.length,
            0
          ),
        0
      )
    case 'skills':
      return section.groups.reduce(
        (total, group) =>
          total +
          group.skills.reduce(
            (skillsTotal, skill) =>
              skillsTotal + optionalFactCount(skill.details),
            0
          ),
        0
      )
  }
}

export const factsCatalogueCounts = (
  catalogue: FactsCatalogueV1
): FactsCatalogueCounts => ({
  assets: catalogue.assets.length,
  evidence: catalogue.evidence.length,
  facts: catalogue.sections.reduce(
    (total, section) => total + reviewedFactCount(section),
    0
  ),
  sections: catalogue.sections.length,
})

const searchableText = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(searchableText).join('\n')
  if (value !== null && typeof value === 'object') {
    return Object.values(value).map(searchableText).join('\n')
  }
  return ''
}

/**
 * Keeps catalogue hierarchy intact while narrowing the page to sections that
 * contain the requested text. The source catalogue remains immutable.
 */
export const filterFactsSections = (
  sections: FactsCatalogueV1['sections'],
  query: string
): ReadonlyArray<FactsSectionV1> => {
  const normalized = query.trim().toLocaleLowerCase()
  if (normalized.length === 0) return sections
  return sections.filter((section) =>
    searchableText(section).toLocaleLowerCase().includes(normalized)
  )
}

export const shortCommit = (commit: string): string => commit.slice(0, 12)

export const shortReleaseId = (releaseId: string): string =>
  `${releaseId.slice(0, 11)}…${releaseId.slice(-8)}`
