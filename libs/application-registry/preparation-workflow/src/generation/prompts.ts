import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import type { JsonSchema } from 'effect/JsonSchema'

import type { StructuredGenerationRequest } from './service'

export type CvDraftGenerationInput = {
  readonly factsCatalogue: FactsCatalogueV1
  readonly guidance: CvGenerationGuidanceV1
  readonly jobContext: unknown
  readonly locale: string
  readonly schema: JsonSchema
}

const formatted = (value: unknown): string => JSON.stringify(value, null, 2)

export const factsForGeneration = (catalogue: FactsCatalogueV1) => ({
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

/** Fact identities that survive the typed generation visibility projection. */
export const reviewedFactIdsForGeneration = (
  catalogue: FactsCatalogueV1
): ReadonlySet<string> => {
  const ids = new Set<string>()
  const add = (fact: { readonly id: string } | undefined): void => {
    if (fact !== undefined) ids.add(fact.id)
  }
  const addAll = (facts: ReadonlyArray<{ readonly id: string }>): void => {
    facts.forEach(add)
  }

  for (const section of catalogue.sections) {
    switch (section.kind) {
      case 'identity':
        add(section.overview)
        addAll(section.facts)
        break
      case 'contact':
        break
      case 'education':
        section.entries.forEach((entry) => {
          addAll(entry.details)
          add(entry.thesis?.summary)
        })
        break
      case 'experience':
        section.entries
          .filter(({ companyVisibility }) => companyVisibility === 'public')
          .forEach((entry) => {
            add(entry.overview)
            addAll(entry.highlights)
            entry.workstreams.forEach((workstream) => {
              add(workstream.overview)
              addAll(workstream.contributions)
            })
          })
        break
      case 'projects':
        section.entries
          .filter(({ visibility }) => visibility === 'public')
          .forEach((entry) => {
            add(entry.summary)
            entry.contributions.forEach(({ facts }) => {
              addAll(facts)
            })
          })
        break
      case 'skills':
        section.groups.forEach((group) => {
          group.skills.forEach((skill) => {
            add(skill.details)
          })
        })
        break
    }
  }

  return ids
}

export const buildCvDraftGenerationRequest = (
  input: CvDraftGenerationInput
): StructuredGenerationRequest => ({
  instructions: input.guidance.instruction,
  outputSchema: input.schema,
  prompt: [
    `Requested locale: ${input.locale}`,
    'CV generation guidance:',
    formatted(input.guidance),
    'Current job posting snapshot:',
    formatted(input.jobContext),
    'Complete trusted facts catalogue:',
    formatted(factsForGeneration(input.factsCatalogue)),
    'Return one document accepted by the supplied JSON Schema. Keep it concise enough for a one-page CV.',
  ].join('\n\n'),
})

export type CoverLetterGenerationInput = {
  readonly factsCatalogue: FactsCatalogueV1
  readonly jobContext: unknown
  readonly locale: string
  readonly prompt: string
  readonly schema: JsonSchema
}

export const buildCoverLetterGenerationRequest = (
  input: CoverLetterGenerationInput
): StructuredGenerationRequest => ({
  instructions:
    'Write a truthful cover letter. The trusted facts catalogue is the sole source of personal claims; obey embedded section, entry, and fact tailoring guidance, and use the job context only to tailor relevance.',
  outputSchema: input.schema,
  prompt: [
    `Requested locale: ${input.locale}`,
    'User-authored cover-letter instructions:',
    input.prompt,
    'Current job posting snapshot:',
    formatted(input.jobContext),
    'Complete trusted facts catalogue:',
    formatted(factsForGeneration(input.factsCatalogue)),
    'Return only a document accepted by the supplied JSON Schema.',
  ].join('\n\n'),
})
