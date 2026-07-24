import type {
  FactsCatalogueV1,
  FactTailoringGuidanceV1,
  ReviewedFactV1,
} from '@cv/contracts/facts'

export const evidenceReferenceKinds = [
  'reviewed-fact',
  'language',
  'skill',
  'experience',
  'experience-workstream',
  'project',
  'project-contribution',
  'education',
] as const

export type EvidenceReferenceKind = (typeof evidenceReferenceKinds)[number]

/**
 * One reviewed source that can ground an authored claim.
 *
 * IDs are citations, not writing fragments. The label, details, and context
 * carry the reviewed source material that the planner and final author need.
 */
export type EvidenceReference = {
  readonly context: ReadonlyArray<string>
  readonly details: ReadonlyArray<string>
  readonly id: string
  readonly kind: EvidenceReferenceKind
  readonly label: string
}

export type GenerationFactsCatalogue = Pick<
  FactsCatalogueV1,
  '$schema' | 'locale' | 'sections'
>

export const factsForGeneration = (
  catalogue: FactsCatalogueV1
): GenerationFactsCatalogue => ({
  $schema: catalogue.$schema,
  locale: catalogue.locale,
  sections: catalogue.sections.map((section) => {
    switch (section.kind) {
      case 'contact':
        return {
          ...section,
          items: section.items.filter(
            ({ visibility }) => visibility === 'public'
          ),
        }
      case 'education':
        return {
          ...section,
          entries: section.entries.map((entry) =>
            entry.thesis === undefined
              ? entry
              : {
                  ...entry,
                  thesis: {
                    ...entry.thesis,
                    links: entry.thesis.links.filter(
                      ({ visibility }) => visibility !== 'private'
                    ),
                  },
                }
          ),
        }
      case 'experience':
        return {
          ...section,
          entries: section.entries.filter(
            ({ companyVisibility }) => companyVisibility === 'public'
          ),
        }
      case 'projects':
        return {
          ...section,
          entries: section.entries
            .filter(({ visibility }) => visibility === 'public')
            .map((entry) => ({
              ...entry,
              links: entry.links.filter(
                ({ visibility }) => visibility !== 'private'
              ),
            })),
        }
      case 'identity':
      case 'skills':
        return section
      default:
        return section
    }
  }),
})

const present = (
  values: ReadonlyArray<string | undefined>
): ReadonlyArray<string> =>
  values.filter(
    (value): value is string => value !== undefined && value.length > 0
  )

const guidanceDetails = (
  guidance: FactTailoringGuidanceV1 | undefined
): ReadonlyArray<string> =>
  guidance === undefined
    ? []
    : [
        ...(guidance.inclusion === undefined
          ? []
          : [`Inclusion: ${guidance.inclusion}`]),
        ...(guidance.wording === undefined
          ? []
          : [`Wording: ${guidance.wording}`]),
        ...(guidance.instructions ?? []),
      ]

const reviewedFactReference = (
  fact: ReviewedFactV1,
  context: ReadonlyArray<string>,
  inheritedGuidance?: FactTailoringGuidanceV1
): EvidenceReference => ({
  context,
  details: [
    ...guidanceDetails(inheritedGuidance),
    ...guidanceDetails(fact.guidance),
  ],
  id: fact.id,
  kind: 'reviewed-fact',
  label: fact.text,
})

/**
 * Canonical generation-visible evidence projection.
 *
 * Prompt construction, semantic validation, briefs, and composition all use
 * this projection so they cannot disagree about which IDs are selectable.
 */
export const evidenceReferencesForGeneration = (
  catalogue: FactsCatalogueV1
): ReadonlyArray<EvidenceReference> => {
  const references: Array<EvidenceReference> = []

  for (const section of factsForGeneration(catalogue).sections) {
    switch (section.kind) {
      case 'identity':
        if (section.overview !== undefined) {
          references.push(
            reviewedFactReference(
              section.overview,
              ['Identity overview'],
              section.guidance
            )
          )
        }
        section.facts.forEach((fact) => {
          references.push(
            reviewedFactReference(fact, ['Identity'], section.guidance)
          )
        })
        section.languages.forEach((language) => {
          references.push({
            context: ['Identity language'],
            details: present([
              language.proficiency === undefined
                ? undefined
                : `Proficiency: ${language.proficiency}`,
              ...guidanceDetails(section.guidance),
            ]),
            id: language.id,
            kind: 'language',
            label: language.name,
          })
        })
        break
      case 'contact':
        break
      case 'education':
        section.entries.forEach((entry) => {
          const educationContext = [
            `Education: ${entry.degree} — ${entry.institution}`,
          ]
          references.push({
            context: educationContext,
            details: present([
              `Period: ${entry.period}`,
              entry.location === undefined
                ? undefined
                : `Location: ${entry.location}`,
              ...guidanceDetails(section.guidance),
              ...guidanceDetails(entry.guidance),
            ]),
            id: entry.id,
            kind: 'education',
            label: `${entry.degree} — ${entry.institution}`,
          })
          entry.details.forEach((fact) => {
            references.push(
              reviewedFactReference(fact, educationContext, entry.guidance)
            )
          })
          if (entry.thesis !== undefined) {
            references.push(
              reviewedFactReference(
                entry.thesis.summary,
                [...educationContext, `Thesis: ${entry.thesis.title}`],
                entry.guidance
              )
            )
          }
        })
        break
      case 'experience':
        section.entries.forEach((entry) => {
          const experienceContext = [
            `Experience: ${entry.roles.join(', ')} — ${entry.company}`,
          ]
          references.push({
            context: experienceContext,
            details: present([
              `Period: ${entry.period}`,
              entry.location === undefined
                ? undefined
                : `Location: ${entry.location}`,
              entry.technologies.length === 0
                ? undefined
                : `Technologies: ${entry.technologies.join(', ')}`,
              ...guidanceDetails(section.guidance),
              ...guidanceDetails(entry.guidance),
            ]),
            id: entry.id,
            kind: 'experience',
            label: `${entry.roles.join(', ')} — ${entry.company}`,
          })
          if (entry.overview !== undefined) {
            references.push(
              reviewedFactReference(
                entry.overview,
                experienceContext,
                entry.guidance
              )
            )
          }
          entry.highlights.forEach((fact) => {
            references.push(
              reviewedFactReference(fact, experienceContext, entry.guidance)
            )
          })
          entry.workstreams.forEach((workstream) => {
            const workstreamContext = [
              ...experienceContext,
              `Workstream: ${workstream.title}`,
            ]
            references.push({
              context: workstreamContext,
              details: present([
                workstream.technologies.length === 0
                  ? undefined
                  : `Technologies: ${workstream.technologies.join(', ')}`,
                ...guidanceDetails(entry.guidance),
                ...guidanceDetails(workstream.guidance),
              ]),
              id: workstream.id,
              kind: 'experience-workstream',
              label: workstream.title,
            })
            if (workstream.overview !== undefined) {
              references.push(
                reviewedFactReference(
                  workstream.overview,
                  workstreamContext,
                  workstream.guidance
                )
              )
            }
            workstream.contributions.forEach((fact) => {
              references.push(
                reviewedFactReference(
                  fact,
                  workstreamContext,
                  workstream.guidance
                )
              )
            })
          })
        })
        break
      case 'projects':
        section.entries.forEach((entry) => {
          const projectContext = [`Project: ${entry.name}`]
          references.push({
            context: projectContext,
            details: present([
              entry.technologies.length === 0
                ? undefined
                : `Technologies: ${entry.technologies.join(', ')}`,
              ...guidanceDetails(section.guidance),
              ...guidanceDetails(entry.guidance),
            ]),
            id: entry.id,
            kind: 'project',
            label: entry.name,
          })
          references.push(
            reviewedFactReference(entry.summary, projectContext, entry.guidance)
          )
          entry.contributions.forEach((contribution) => {
            const contributionContext = [
              ...projectContext,
              `Contribution: ${contribution.title}`,
            ]
            references.push({
              context: contributionContext,
              details: present([
                contribution.area === undefined
                  ? undefined
                  : `Area: ${contribution.area}`,
                contribution.technologies.length === 0
                  ? undefined
                  : `Technologies: ${contribution.technologies.join(', ')}`,
                ...guidanceDetails(entry.guidance),
                ...guidanceDetails(contribution.guidance),
              ]),
              id: contribution.id,
              kind: 'project-contribution',
              label: contribution.title,
            })
            contribution.facts.forEach((fact) => {
              references.push(
                reviewedFactReference(
                  fact,
                  contributionContext,
                  contribution.guidance
                )
              )
            })
          })
        })
        break
      case 'skills':
        section.groups.forEach((group) => {
          group.skills.forEach((skill) => {
            const skillContext = [`Skill group: ${group.title} (${group.id})`]
            references.push({
              context: skillContext,
              details: [
                ...guidanceDetails(section.guidance),
                ...guidanceDetails(group.guidance),
                ...(skill.details === undefined ? [] : [skill.details.text]),
              ],
              id: skill.id,
              kind: 'skill',
              label: skill.name,
            })
            if (skill.details !== undefined) {
              references.push(
                reviewedFactReference(
                  skill.details,
                  [...skillContext, `Skill: ${skill.name}`],
                  group.guidance
                )
              )
            }
          })
        })
        break
    }
  }

  return references
}

export const evidenceIdsForGeneration = (
  references: ReadonlyArray<EvidenceReference>
): ReadonlySet<string> => new Set(references.map(({ id }) => id))

export const reviewedFactIdsForGeneration = (
  catalogue: FactsCatalogueV1
): ReadonlySet<string> =>
  new Set(
    evidenceReferencesForGeneration(catalogue)
      .filter(({ kind }) => kind === 'reviewed-fact')
      .map(({ id }) => id)
  )

export const resolveEvidenceReferences = (
  references: ReadonlyArray<EvidenceReference>,
  ids: ReadonlyArray<string>
): ReadonlyArray<EvidenceReference> => {
  const indexed = new Map(
    references.map((reference) => [reference.id, reference])
  )
  return ids.flatMap((id) => {
    const reference = indexed.get(id)
    return reference === undefined ? [] : [reference]
  })
}
