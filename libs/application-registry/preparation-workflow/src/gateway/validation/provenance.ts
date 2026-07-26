import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'
import { PreparationWorkflowError } from '../../domain'
import { cvAuthoringSourceForGeneration } from '../../generation/prompts'

export type CvProvenanceIssue = {
  readonly message: string
  readonly path: ReadonlyArray<string | number>
}

export const cvProvenanceIssues = (
  catalogue: FactsCatalogueV1,
  document: CvDocumentV1
): ReadonlyArray<CvProvenanceIssue> => {
  const bindings = cvAuthoringSourceForGeneration(catalogue)
  const experience = new Map(
    bindings.experience.map((entry) => [entry.id, entry])
  )
  const projects = new Map(bindings.projects.map((entry) => [entry.id, entry]))
  const education = new Map(
    bindings.education.map((entry) => [entry.id, entry])
  )
  const skills = new Map(bindings.skillGroups.map((group) => [group.id, group]))
  const issues: Array<CvProvenanceIssue> = []
  if (!bindings.person.names.includes(document.person.name)) {
    issues.push({
      message: 'person.name was not copied from reviewed identity metadata',
      path: ['person', 'name'],
    })
  }
  if (
    document.person.location !== undefined &&
    !bindings.person.locations.includes(document.person.location)
  ) {
    issues.push({
      message: 'person.location was not copied from reviewed identity metadata',
      path: ['person', 'location'],
    })
  }
  for (const [index, contact] of document.person.contacts.entries()) {
    const contactPath = ['person', 'contacts', index] as const
    const source =
      bindings.person.contacts.find(
        (candidate) =>
          candidate.value === contact.value &&
          candidate.kind === contact.kind &&
          candidate.url === contact.href &&
          (candidate.label === undefined || candidate.label === contact.label)
      ) ??
      bindings.person.contacts.find(
        (candidate) => candidate.value === contact.value
      ) ??
      bindings.person.contacts.find(
        (candidate) =>
          candidate.url !== undefined && candidate.url === contact.href
      ) ??
      bindings.person.contacts.find(
        (candidate) =>
          candidate.label !== undefined && candidate.label === contact.label
      ) ??
      bindings.person.contacts.find(
        (candidate) => candidate.kind === contact.kind
      )
    if (source === undefined) {
      issues.push({
        message: `contact:${contact.value} was not copied from a public contact`,
        path: [...contactPath, 'value'],
      })
      continue
    }
    if (contact.value !== source.value) {
      issues.push({
        message: `contact:${source.sourceId}.value was changed`,
        path: [...contactPath, 'value'],
      })
    }
    if (contact.kind !== source.kind) {
      issues.push({
        message: `contact:${source.sourceId}.kind was changed`,
        path: [...contactPath, 'kind'],
      })
    }
    if (contact.href !== source.url) {
      issues.push({
        message: `contact:${source.sourceId}.href was changed`,
        path: [...contactPath, 'href'],
      })
    }
    if (source.label !== undefined && contact.label !== source.label) {
      issues.push({
        message: `contact:${source.sourceId}.label was changed`,
        path: [...contactPath, 'label'],
      })
    }
  }
  for (const [index, item] of document.experience.entries()) {
    const source = experience.get(item.id)
    if (source === undefined) {
      issues.push({
        message: `experience:${item.id} is absent from the facts catalogue`,
        path: ['experience', index, 'id'],
      })
      continue
    }
    if (item.company !== source.company)
      issues.push({
        message: `experience:${item.id}.company was changed`,
        path: ['experience', index, 'company'],
      })
    if (!source.roles.includes(item.role))
      issues.push({
        message: `experience:${item.id}.role was changed`,
        path: ['experience', index, 'role'],
      })
    if (item.period !== source.period)
      issues.push({
        message: `experience:${item.id}.period was changed`,
        path: ['experience', index, 'period'],
      })
    if (item.location !== undefined && item.location !== source.location)
      issues.push({
        message: `experience:${item.id}.location was changed`,
        path: ['experience', index, 'location'],
      })
    for (const [technologyIndex, technology] of item.technologies.entries()) {
      if (!source.technologies.includes(technology)) {
        issues.push({
          message: `experience:${item.id}.technology:${technology} is unsupported`,
          path: ['experience', index, 'technologies', technologyIndex],
        })
      }
    }
  }
  for (const [index, item] of document.projects.entries()) {
    const source = projects.get(item.id)
    if (source === undefined) {
      issues.push({
        message: `project:${item.id} is absent from the facts catalogue`,
        path: ['projects', index, 'id'],
      })
      continue
    }
    if (item.name !== source.name)
      issues.push({
        message: `project:${item.id}.name was changed`,
        path: ['projects', index, 'name'],
      })
    for (const [technologyIndex, technology] of item.technologies.entries()) {
      if (!source.technologies.includes(technology)) {
        issues.push({
          message: `project:${item.id}.technology:${technology} is unsupported`,
          path: ['projects', index, 'technologies', technologyIndex],
        })
      }
    }
    for (const [linkIndex, link] of item.links.entries()) {
      const linkPath = ['projects', index, 'links', linkIndex] as const
      const linkSource =
        source.links.find((candidate) => candidate.url === link.href) ??
        source.links.find((candidate) => candidate.label === link.label) ??
        source.links.find(
          (candidate) =>
            candidate.label === link.value || candidate.url === link.value
        )
      if (linkSource === undefined) {
        issues.push(
          {
            message: `project:${item.id}.link:${linkIndex}.label is unsupported`,
            path: [...linkPath, 'label'],
          },
          {
            message: `project:${item.id}.link:${linkIndex}.value is unsupported`,
            path: [...linkPath, 'value'],
          }
        )
        if (link.href !== undefined) {
          issues.push({
            message: `project:${item.id}.link:${linkIndex}.href is unsupported`,
            path: [...linkPath, 'href'],
          })
        }
        continue
      }
      if (link.label !== linkSource.label) {
        issues.push({
          message: `project:${item.id}.link:${linkIndex}.label was changed`,
          path: [...linkPath, 'label'],
        })
      }
      if (link.value !== linkSource.label && link.value !== linkSource.url) {
        issues.push({
          message: `project:${item.id}.link:${linkIndex}.value was changed`,
          path: [...linkPath, 'value'],
        })
      }
      if (link.href !== linkSource.url) {
        issues.push({
          message: `project:${item.id}.link:${linkIndex}.href was changed`,
          path: [...linkPath, 'href'],
        })
      }
    }
  }
  for (const [index, item] of document.education.entries()) {
    const source = education.get(item.id)
    if (source === undefined) {
      issues.push({
        message: `education:${item.id} is absent from the facts catalogue`,
        path: ['education', index, 'id'],
      })
      continue
    }
    if (item.institution !== source.institution)
      issues.push({
        message: `education:${item.id}.institution was changed`,
        path: ['education', index, 'institution'],
      })
    if (item.qualification !== source.degree)
      issues.push({
        message: `education:${item.id}.qualification was changed`,
        path: ['education', index, 'qualification'],
      })
    if (item.period !== undefined && item.period !== source.period)
      issues.push({
        message: `education:${item.id}.period was changed`,
        path: ['education', index, 'period'],
      })
    if (item.location !== undefined && item.location !== source.location)
      issues.push({
        message: `education:${item.id}.location was changed`,
        path: ['education', index, 'location'],
      })
  }
  for (const [index, item] of document.skills.entries()) {
    const source = skills.get(item.id)
    if (source === undefined) {
      issues.push({
        message: `skills:${item.id} is absent from the facts catalogue`,
        path: ['skills', index, 'id'],
      })
      continue
    }
    if (item.label !== source.label)
      issues.push({
        message: `skills:${item.id}.label was changed`,
        path: ['skills', index, 'label'],
      })
    for (const [skillIndex, skill] of item.items.entries()) {
      if (!source.items.includes(skill)) {
        issues.push({
          message: `skills:${item.id}.item:${skill} is unsupported`,
          path: ['skills', index, 'items', skillIndex],
        })
      }
    }
  }
  const reviewedAdditionalEvidenceIds = new Set(
    bindings.additionalSectionItems.map(({ id }) => id)
  )
  for (const [sectionIndex, section] of document.additionalSections.entries()) {
    for (const [itemIndex, item] of section.items.entries()) {
      if (!reviewedAdditionalEvidenceIds.has(item.id)) {
        issues.push({
          message: `additional:${section.id}:${item.id} is not a reviewed additional-section evidence ID`,
          path: ['additionalSections', sectionIndex, 'items', itemIndex, 'id'],
        })
      }
    }
  }
  return issues
}

export const validateCvProvenance = (
  catalogue: FactsCatalogueV1,
  document: CvDocumentV1
): Effect.Effect<void, PreparationWorkflowError> => {
  const issues = cvProvenanceIssues(catalogue, document)
  return issues.length === 0
    ? Effect.void
    : Effect.fail(
        new PreparationWorkflowError({
          message: `CV failed deterministic provenance checks: ${issues
            .map(({ message }) => message)
            .join('; ')}`,
          stage: 'validation',
        })
      )
}
