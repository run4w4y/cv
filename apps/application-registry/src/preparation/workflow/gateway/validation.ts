import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import { factsForGeneration } from '../../prompts'
import type { EvidencePlan, JobAnalysis, SectionBrief } from '../domain'
import { PreparationWorkflowError } from '../domain'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const collectReviewedFactIds = (
  catalogue: FactsCatalogueV1
): ReadonlySet<string> => {
  const ids = new Set<string>()
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (!isRecord(value)) return
    if (typeof value.id === 'string' && typeof value.text === 'string') {
      ids.add(value.id)
    }
    for (const child of Object.values(value)) visit(child)
  }
  visit(factsForGeneration(catalogue).sections)
  return ids
}

const duplicateIds = (ids: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates]
}

export const validateJobAnalysis = (analysis: JobAnalysis) => {
  const duplicates = duplicateIds(
    analysis.requirements.map((requirement) => requirement.id)
  )
  return duplicates.length === 0
    ? Effect.succeed(analysis)
    : Effect.fail(
        new PreparationWorkflowError({
          message: `Job analysis contained duplicate requirement IDs: ${duplicates.join(', ')}`,
          stage: 'analysis',
        })
      )
}

export const validateEvidencePlan = (
  analysis: JobAnalysis,
  catalogue: FactsCatalogueV1,
  plan: EvidencePlan
) =>
  Effect.gen(function* () {
    const requirementIds = new Set(
      analysis.requirements.map((requirement) => requirement.id)
    )
    const factIds = collectReviewedFactIds(catalogue)
    const plannedRequirementIds = [
      ...plan.matches.map(({ requirementId }) => requirementId),
      ...plan.uncoveredRequirementIds,
    ]
    const unknownRequirements = plannedRequirementIds.filter(
      (id) => !requirementIds.has(id)
    )
    const unknownFacts = plan.matches
      .flatMap(({ factIds: selected }) => selected)
      .filter((id) => !factIds.has(id))

    if (unknownRequirements.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan referenced unknown requirement IDs: ${[
            ...new Set(unknownRequirements),
          ].join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    if (unknownFacts.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan referenced unknown fact IDs: ${[
            ...new Set(unknownFacts),
          ].join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    const missingRequirements = [...requirementIds].filter(
      (id) => !plannedRequirementIds.includes(id)
    )
    if (missingRequirements.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan omitted requirement IDs: ${missingRequirements.join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    const duplicateRequirements = duplicateIds(plannedRequirementIds)
    if (duplicateRequirements.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan covered requirement IDs more than once: ${duplicateRequirements.join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    const duplicateFacts = plan.matches.flatMap((match) =>
      duplicateIds(match.factIds).map(
        (factId) => `${match.requirementId}:${factId}`
      )
    )
    if (duplicateFacts.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan repeated fact IDs within a requirement: ${duplicateFacts.join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    return plan
  })

export const validateSectionBrief = (
  catalogue: FactsCatalogueV1,
  plan: EvidencePlan,
  sectionId: string,
  brief: SectionBrief
) =>
  Effect.gen(function* () {
    if (brief.sectionId !== sectionId) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section brief ${brief.sectionId} did not match requested section ${sectionId}.`,
          stage: 'briefs',
        })
      )
    }
    const factIds = collectReviewedFactIds(catalogue)
    const unknown = brief.factIds.filter((id) => !factIds.has(id))
    if (unknown.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} referenced unknown fact IDs: ${[
            ...new Set(unknown),
          ].join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    const allowedFactIds = new Set(
      plan.matches.flatMap((match) => match.factIds)
    )
    const outsidePlan = brief.factIds.filter((id) => !allowedFactIds.has(id))
    if (outsidePlan.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} referenced fact IDs outside the validated evidence plan: ${[
            ...new Set(outsidePlan),
          ].join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    const duplicates = duplicateIds(brief.factIds)
    if (duplicates.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} repeated fact IDs: ${duplicates.join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    return brief
  })

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
    const technologies = new Set([
      ...source.technologies,
      ...source.workstreams.flatMap((workstream) => workstream.technologies),
    ])
    for (const technology of item.technologies) {
      if (!technologies.has(technology))
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
    const technologies = new Set([
      ...source.technologies,
      ...source.contributions.flatMap(
        (contribution) => contribution.technologies
      ),
    ])
    for (const technology of item.technologies) {
      if (!technologies.has(technology))
        issues.push(
          `project:${item.id}.technology:${technology} is unsupported`
        )
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
    if (item.period !== source.period)
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
    const names = new Set(source.skills.map((skill) => skill.name))
    for (const skill of item.items) {
      if (!names.has(skill))
        issues.push(`skills:${item.id}.item:${skill} is unsupported`)
    }
  }
  const reviewedFactIds = collectReviewedFactIds(catalogue)
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
