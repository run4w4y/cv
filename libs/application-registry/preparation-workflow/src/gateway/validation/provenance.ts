import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'
import { difference } from 'es-toolkit/array'
import { PreparationWorkflowError } from '../../domain'
import { reviewedFactIdsForGeneration } from '../../generation/prompts'

export const validateCvProvenance = (
  catalogue: FactsCatalogueV1,
  document: CvDocumentV1
) => {
  const identities = catalogue.sections.filter(
    (section) => section.kind === 'identity'
  )
  const publicContacts = catalogue.sections
    .filter((section) => section.kind === 'contact')
    .flatMap((section) => section.items)
    .filter((contact) => contact.visibility === 'public')
  const experience = new Map<
    string,
    Extract<
      FactsCatalogueV1['sections'][number],
      { readonly kind: 'experience' }
    >['entries'][number]
  >()
  const projects = new Map<
    string,
    Extract<
      FactsCatalogueV1['sections'][number],
      { readonly kind: 'projects' }
    >['entries'][number]
  >()
  const education = new Map<
    string,
    Extract<
      FactsCatalogueV1['sections'][number],
      { readonly kind: 'education' }
    >['entries'][number]
  >()
  const skills = new Map<
    string,
    Extract<
      FactsCatalogueV1['sections'][number],
      { readonly kind: 'skills' }
    >['groups'][number]
  >()
  for (const section of catalogue.sections) {
    switch (section.kind) {
      case 'experience':
        for (const entry of section.entries) {
          if (entry.companyVisibility === 'public') {
            experience.set(entry.id, entry)
          }
        }
        break
      case 'projects':
        for (const entry of section.entries) {
          if (entry.visibility === 'public') projects.set(entry.id, entry)
        }
        break
      case 'education':
        for (const entry of section.entries) education.set(entry.id, entry)
        break
      case 'skills':
        for (const group of section.groups) skills.set(group.id, group)
        break
      case 'contact':
      case 'identity':
        break
    }
  }
  const issues: Array<string> = []
  if (!identities.some((identity) => identity.name === document.person.name)) {
    issues.push('person.name was not copied from reviewed identity metadata')
  }
  if (
    document.person.location !== undefined &&
    !identities.some(
      (identity) => identity.location === document.person.location
    )
  ) {
    issues.push(
      'person.location was not copied from reviewed identity metadata'
    )
  }
  for (const contact of document.person.contacts) {
    const source = publicContacts.find(
      (candidate) =>
        candidate.value === contact.value &&
        (contact.href === undefined || candidate.url === contact.href)
    )
    if (source === undefined) {
      issues.push(
        `contact:${contact.value} was not copied from a public contact`
      )
    }
  }
  for (const item of document.experience) {
    const source = experience.get(item.id)
    if (source === undefined) {
      issues.push(`experience:${item.id} is absent from the facts catalogue`)
      continue
    }
    if (item.company !== source.company)
      issues.push(`experience:${item.id}.company was changed`)
    if (!source.roles.includes(item.role))
      issues.push(`experience:${item.id}.role was changed`)
    if (item.period !== source.period)
      issues.push(`experience:${item.id}.period was changed`)
    if (item.location !== undefined && item.location !== source.location)
      issues.push(`experience:${item.id}.location was changed`)
    const supportedTechnologies = [
      ...source.technologies,
      ...source.workstreams.flatMap((workstream) => workstream.technologies),
    ]
    for (const technology of difference(
      item.technologies,
      supportedTechnologies
    )) {
      issues.push(
        `experience:${item.id}.technology:${technology} is unsupported`
      )
    }
  }
  for (const item of document.projects) {
    const source = projects.get(item.id)
    if (source === undefined) {
      issues.push(`project:${item.id} is absent from the facts catalogue`)
      continue
    }
    if (item.name !== source.name)
      issues.push(`project:${item.id}.name was changed`)
    const supportedTechnologies = [
      ...source.technologies,
      ...source.contributions.flatMap(
        (contribution) => contribution.technologies
      ),
    ]
    for (const technology of difference(
      item.technologies,
      supportedTechnologies
    )) {
      issues.push(`project:${item.id}.technology:${technology} is unsupported`)
    }
    const publicLinks = source.links.filter(
      (link) => link.visibility !== 'private'
    )
    for (const link of item.links) {
      const supported = publicLinks.some((candidate) =>
        link.href === undefined
          ? link.value === candidate.label || link.value === candidate.url
          : link.href === candidate.url
      )
      if (!supported)
        issues.push(`project:${item.id}.link:${link.value} is unsupported`)
    }
  }
  for (const item of document.education) {
    const source = education.get(item.id)
    if (source === undefined) {
      issues.push(`education:${item.id} is absent from the facts catalogue`)
      continue
    }
    if (item.institution !== source.institution)
      issues.push(`education:${item.id}.institution was changed`)
    if (item.qualification !== source.degree)
      issues.push(`education:${item.id}.qualification was changed`)
    if (item.period !== undefined && item.period !== source.period)
      issues.push(`education:${item.id}.period was changed`)
    if (item.location !== undefined && item.location !== source.location)
      issues.push(`education:${item.id}.location was changed`)
  }
  for (const item of document.skills) {
    const source = skills.get(item.id)
    if (source === undefined) {
      issues.push(`skills:${item.id} is absent from the facts catalogue`)
      continue
    }
    const supportedSkills = source.skills.map(({ name }) => name)
    for (const skill of difference(item.items, supportedSkills)) {
      issues.push(`skills:${item.id}.item:${skill} is unsupported`)
    }
  }
  const reviewedFactIds = reviewedFactIdsForGeneration(catalogue)
  for (const section of document.additionalSections) {
    for (const item of section.items) {
      if (!reviewedFactIds.has(item.id)) {
        issues.push(
          `additional:${section.id}:${item.id} is not a reviewed fact ID`
        )
      }
    }
  }
  return issues.length === 0
    ? Effect.void
    : Effect.fail(
        new PreparationWorkflowError({
          message: `CV failed deterministic provenance checks: ${issues.join('; ')}`,
          stage: 'validation',
        })
      )
}
