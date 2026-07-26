import {
  CvAdditionalItemV1Schema,
  CvAdditionalSectionV1Schema,
  type CvContactLinkV1,
  CvExperienceItemV1Schema,
  CvProjectItemV1Schema,
  CvSkillGroupV1Schema,
} from '@cv/contracts/document'
import type { ContactItemV1, FactsCatalogueV1 } from '@cv/contracts/facts'
import { Schema } from 'effect'

import {
  type EvidenceReference,
  evidenceReferencesForGeneration,
  factsForGeneration,
} from './evidence'

export type CvAuthoringSource = {
  readonly additionalSectionItems: ReadonlyArray<
    EvidenceReference & {
      readonly sectionTitle: string
    }
  >
  readonly education: ReadonlyArray<{
    readonly degree: string
    readonly evidenceIds: ReadonlyArray<string>
    readonly id: string
    readonly institution: string
    readonly location?: string
    readonly period: string
  }>
  readonly experience: ReadonlyArray<{
    readonly company: string
    readonly evidenceIds: ReadonlyArray<string>
    readonly id: string
    readonly location?: string
    readonly period: string
    readonly roles: ReadonlyArray<string>
    readonly technologies: ReadonlyArray<string>
  }>
  readonly person: {
    readonly contacts: ReadonlyArray<{
      readonly kind: CvContactLinkV1['kind']
      readonly label?: string
      readonly sourceId: string
      readonly url?: string
      readonly value: string
    }>
    readonly locations: ReadonlyArray<string>
    readonly names: ReadonlyArray<string>
  }
  readonly projects: ReadonlyArray<{
    readonly evidenceIds: ReadonlyArray<string>
    readonly id: string
    readonly links: ReadonlyArray<{
      readonly label: string
      readonly url: string
    }>
    readonly name: string
    readonly technologies: ReadonlyArray<string>
  }>
  readonly references: ReadonlyArray<EvidenceReference>
  readonly skillGroups: ReadonlyArray<{
    readonly evidenceIds: ReadonlyArray<string>
    readonly id: string
    readonly items: ReadonlyArray<string>
    readonly label: string
  }>
}

const unique = (values: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...new Set(values),
]

const experienceEvidenceIds = (
  entry: Extract<
    ReturnType<typeof factsForGeneration>['sections'][number],
    { readonly kind: 'experience' }
  >['entries'][number]
): ReadonlyArray<string> =>
  unique([
    entry.id,
    ...(entry.overview === undefined ? [] : [entry.overview.id]),
    ...entry.highlights.map(({ id }) => id),
    ...entry.workstreams.flatMap((workstream) => [
      workstream.id,
      ...(workstream.overview === undefined ? [] : [workstream.overview.id]),
      ...workstream.contributions.map(({ id }) => id),
    ]),
  ])

const projectEvidenceIds = (
  entry: Extract<
    ReturnType<typeof factsForGeneration>['sections'][number],
    { readonly kind: 'projects' }
  >['entries'][number]
): ReadonlyArray<string> =>
  unique([
    entry.id,
    entry.summary.id,
    ...entry.contributions.flatMap((contribution) => [
      contribution.id,
      ...contribution.facts.map(({ id }) => id),
    ]),
  ])

const educationEvidenceIds = (
  entry: Extract<
    ReturnType<typeof factsForGeneration>['sections'][number],
    { readonly kind: 'education' }
  >['entries'][number]
): ReadonlyArray<string> =>
  unique([
    entry.id,
    ...entry.details.map(({ id }) => id),
    ...(entry.thesis === undefined ? [] : [entry.thesis.summary.id]),
  ])

const skillGroupEvidenceIds = (
  group: Extract<
    ReturnType<typeof factsForGeneration>['sections'][number],
    { readonly kind: 'skills' }
  >['groups'][number]
): ReadonlyArray<string> =>
  unique(
    group.skills.flatMap((skill) => [
      skill.id,
      ...(skill.details === undefined ? [] : [skill.details.id]),
    ])
  )

const boundedValidValues = <A>(
  values: ReadonlyArray<A>,
  accepts: (candidate: ReadonlyArray<A>) => boolean
): ReadonlyArray<A> => {
  const accepted: Array<A> = []
  for (const value of values) {
    const candidate = [...accepted, value]
    if (accepts(candidate)) accepted.push(value)
  }
  return accepted
}

const acceptsExperienceTechnologies = Schema.is(
  CvExperienceItemV1Schema.fields.technologies
)
const acceptsCvProjectLinks = Schema.is(CvProjectItemV1Schema.fields.links)
const acceptsProjectBindingLinks = (
  candidate: ReadonlyArray<{ readonly label: string; readonly url: string }>
): boolean =>
  acceptsCvProjectLinks(
    candidate.map(({ label, url }) => ({
      href: url,
      kind: 'website' as const,
      label,
      value: label,
    }))
  )
const acceptsProjectTechnologies = Schema.is(
  CvProjectItemV1Schema.fields.technologies
)
const acceptsSkillItems = Schema.is(CvSkillGroupV1Schema.fields.items)
const acceptsAdditionalItem = Schema.is(CvAdditionalItemV1Schema)
const acceptsAdditionalSectionTitle = Schema.is(
  CvAdditionalSectionV1Schema.fields.title
)
const defaultAdditionalSectionTitle = 'Additional'
const normalizeContactKindForCv = (
  kind: ContactItemV1['kind']
): CvContactLinkV1['kind'] =>
  kind === 'telegram' || kind === 'social' ? 'other' : kind

/**
 * Exact source bindings for fields that behave as foreign keys or copied
 * metadata in the authored CV document.
 */
export const cvAuthoringSourceForGeneration = (
  catalogue: FactsCatalogueV1
): CvAuthoringSource => {
  const visible = factsForGeneration(catalogue)
  const references = evidenceReferencesForGeneration(catalogue)
  const identities = visible.sections.filter(
    (section) => section.kind === 'identity'
  )

  return {
    additionalSectionItems: references
      .filter(({ kind }) => kind === 'reviewed-fact' || kind === 'language')
      .flatMap((reference) =>
        acceptsAdditionalItem({ id: reference.id, text: reference.label })
          ? [
              {
                ...reference,
                sectionTitle:
                  reference.context.find(acceptsAdditionalSectionTitle) ??
                  defaultAdditionalSectionTitle,
              },
            ]
          : []
      ),
    education: visible.sections
      .filter((section) => section.kind === 'education')
      .flatMap(({ entries }) =>
        entries.map((entry) => ({
          degree: entry.degree,
          evidenceIds: educationEvidenceIds(entry),
          id: entry.id,
          institution: entry.institution,
          ...(entry.location === undefined ? {} : { location: entry.location }),
          period: entry.period,
        }))
      ),
    experience: visible.sections
      .filter((section) => section.kind === 'experience')
      .flatMap(({ entries }) =>
        entries.flatMap((entry) =>
          entry.roles.length === 0
            ? []
            : [
                {
                  company: entry.company,
                  evidenceIds: experienceEvidenceIds(entry),
                  id: entry.id,
                  ...(entry.location === undefined
                    ? {}
                    : { location: entry.location }),
                  period: entry.period,
                  roles: entry.roles,
                  technologies: boundedValidValues(
                    unique([
                      ...entry.technologies,
                      ...entry.workstreams.flatMap(
                        (workstream) => workstream.technologies
                      ),
                    ]),
                    acceptsExperienceTechnologies
                  ),
                },
              ]
        )
      ),
    person: {
      contacts: visible.sections
        .filter((section) => section.kind === 'contact')
        .flatMap(({ items }) =>
          items.map(({ id, kind, label, url, value }) => ({
            kind: normalizeContactKindForCv(kind),
            ...(label === undefined ? {} : { label }),
            sourceId: id,
            ...(url === undefined ? {} : { url }),
            value,
          }))
        ),
      locations: identities.flatMap(({ location }) =>
        location === undefined ? [] : [location]
      ),
      names: identities.map(({ name }) => name),
    },
    projects: visible.sections
      .filter((section) => section.kind === 'projects')
      .flatMap(({ entries }) =>
        entries.map((entry) => ({
          evidenceIds: projectEvidenceIds(entry),
          id: entry.id,
          links: boundedValidValues(
            entry.links.map(({ label, url }) => ({ label, url })),
            acceptsProjectBindingLinks
          ),
          name: entry.name,
          technologies: boundedValidValues(
            unique([
              ...entry.technologies,
              ...entry.contributions.flatMap(
                (contribution) => contribution.technologies
              ),
            ]),
            acceptsProjectTechnologies
          ),
        }))
      ),
    references,
    skillGroups: visible.sections
      .filter((section) => section.kind === 'skills')
      .flatMap(({ groups }) =>
        groups.flatMap((group) => {
          const { id, skills, title } = group
          const items = boundedValidValues(
            unique(skills.map(({ name }) => name)),
            acceptsSkillItems
          )
          return items.length === 0
            ? []
            : [
                {
                  evidenceIds: skillGroupEvidenceIds(group),
                  id,
                  items,
                  label: title,
                },
              ]
        })
      ),
  }
}
