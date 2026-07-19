import type { AiJsonGenerationRequest, AiJsonSchema } from '@cv/ai-provider'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'

export type CvDraftGenerationInput = {
  readonly factsCatalogue: FactsCatalogueV1
  readonly guidance: unknown
  readonly jobContext: unknown
  readonly locale: string
  readonly modelId: string
  readonly schema: AiJsonSchema
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
): AiJsonGenerationRequest => ({
  instructions:
    'Build one truthful tailored CV document. Treat the document schema, schema guidance, and embedded facts tailoring guidance as authoritative. Use job context only for relevance and use the trusted facts catalogue as the sole source of factual claims.',
  modelId: input.modelId,
  prompt: [
    `Requested locale: ${input.locale}`,
    'Schema generation guidance:',
    formatted(input.guidance),
    'Current job posting snapshot:',
    formatted(input.jobContext),
    'Complete trusted facts catalogue:',
    formatted(factsForGeneration(input.factsCatalogue)),
    'Return one document accepted by the supplied JSON Schema. Keep it concise enough for a one-page CV.',
  ].join('\n\n'),
  schema: input.schema,
  schemaDescription:
    'A truthful, one-page CV tailored to the supplied job from trusted facts.',
  schemaName: 'tailored_cv_document',
})

export type CoverLetterGenerationInput = {
  readonly factsCatalogue: FactsCatalogueV1
  readonly jobContext: unknown
  readonly locale: string
  readonly modelId: string
  readonly prompt: string
  readonly schema: AiJsonSchema
}

export const buildCoverLetterGenerationRequest = (
  input: CoverLetterGenerationInput
): AiJsonGenerationRequest => ({
  instructions:
    'Write a truthful cover letter. The trusted facts catalogue is the sole source of personal claims; obey embedded section, entry, and fact tailoring guidance, and use the job context only to tailor relevance.',
  modelId: input.modelId,
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
  schema: input.schema,
  schemaDescription: 'A tailored cover-letter document.',
  schemaName: 'cover_letter_document',
})
