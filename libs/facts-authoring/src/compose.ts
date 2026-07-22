import {
  type FactAssetV1,
  type FactEvidenceV1,
  type FactLinkV1,
  type FactsCatalogueV1,
  FactsCatalogueV1Schema,
  type FactsSectionV1,
  type ReviewedFactV1,
} from '@cv/contracts/facts'
import { Effect, Schema } from 'effect'

import {
  FactsAuthoringCompositionError,
  FactsAuthoringValidationError,
} from './errors'
import type {
  DecodedFactsAuthoringCompilationInput,
  FactsAuthoringCompilation,
  FactsAuthoringCompilationInput,
  FactsSectionModuleSource,
} from './model'
import {
  type CvGenerationGuidanceSource,
  CvGenerationGuidanceSourceSchema,
  type FactAssetRegistrySource,
  FactAssetRegistrySourceSchema,
  type FactEvidenceRegistrySource,
  FactEvidenceRegistrySourceSchema,
  type FactSectionSource,
  FactSectionSourceSchema,
  type FactsRepositoryConfigSource,
  FactsRepositoryConfigSourceSchema,
  type ReviewedFactSource,
} from './schema'

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0

const validationError = (path: string, message: string, cause: unknown) =>
  new FactsAuthoringValidationError({ cause, message, path })

const decode = <S extends Schema.Top>(
  schema: S,
  value: unknown,
  path: string
) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError((cause) =>
      validationError(path, `Invalid authored facts value at ${path}.`, cause)
    )
  )

const compositionFailure = (path: string, message: string) =>
  new FactsAuthoringCompositionError({ message, path })

const validateConfig = (config: FactsRepositoryConfigSource) => {
  const duplicate = config.locales.find(
    (locale, index) => config.locales.indexOf(locale) !== index
  )
  if (duplicate) {
    return Effect.fail(
      compositionFailure('facts.config.ts', `Duplicate locale: ${duplicate}`)
    )
  }
  if (!config.locales.includes(config.defaultLocale)) {
    return Effect.fail(
      compositionFailure(
        'facts.config.ts',
        `Default locale ${config.defaultLocale} is not present in locales.`
      )
    )
  }
  return Effect.succeed(config)
}

export const decodeFactsRepositoryConfig = Effect.fn(
  'FactsAuthoring.decodeRepositoryConfig'
)((input: unknown) =>
  decode(FactsRepositoryConfigSourceSchema, input, 'facts.config.ts').pipe(
    Effect.flatMap(validateConfig)
  )
)

export const decodeFactAssetRegistry = Effect.fn(
  'FactsAuthoring.decodeAssetRegistry'
)((input: unknown, path = 'facts/assets.ts') =>
  decode(FactAssetRegistrySourceSchema, input, path)
)

export const decodeFactEvidenceRegistry = Effect.fn(
  'FactsAuthoring.decodeEvidenceRegistry'
)((input: unknown, path = 'facts/evidence.ts') =>
  decode(FactEvidenceRegistrySourceSchema, input, path)
)

export const decodeCvGenerationGuidance = Effect.fn(
  'FactsAuthoring.decodeCvGenerationGuidance'
)((input: unknown, path = 'generation/cv.ts') =>
  decode(CvGenerationGuidanceSourceSchema, input, path)
)

const compileEvidence = (
  evidence: FactEvidenceRegistrySource
): ReadonlyArray<FactEvidenceV1> =>
  Object.entries(evidence)
    .map(([id, source]) => ({ id, ...source }))
    .sort((left, right) => compareText(left.id, right.id))

const compileAssets = (
  assets: FactAssetRegistrySource,
  assetDigests: Readonly<Record<string, string>>
): Effect.Effect<ReadonlyArray<FactAssetV1>, FactsAuthoringCompositionError> =>
  Effect.forEach(
    Object.entries(assets).sort(([left], [right]) => compareText(left, right)),
    ([id, asset]) => {
      const sha256 = assetDigests[id]
      return sha256
        ? Effect.succeed({
            description: asset.description,
            id,
            label: asset.label,
            mediaType: asset.mediaType,
            sha256,
          })
        : Effect.fail(
            compositionFailure(
              `assets.${id}`,
              `No computed digest was supplied for asset ${id}.`
            )
          )
    }
  )

const sectionOrder: Readonly<Record<FactsSectionV1['kind'], number>> = {
  identity: 0,
  contact: 1,
  experience: 2,
  projects: 3,
  skills: 4,
  education: 5,
}

const sortSections = (sections: ReadonlyArray<FactsSectionV1>) =>
  [...sections].sort(
    (left, right) => sectionOrder[left.kind] - sectionOrder[right.kind]
  )

type StructuralPath = ReadonlyArray<string | number>

const structuralId = (path: StructuralPath) => path.join('.')

const compileFact = (
  fact: ReviewedFactSource,
  path: StructuralPath
): ReviewedFactV1 => ({ ...fact, id: structuralId(path) })

const compileLink = (
  link: Omit<FactLinkV1, 'id'>,
  path: StructuralPath
): FactLinkV1 => ({ ...link, id: structuralId(path) })

const compileSection = (section: FactSectionSource): FactsSectionV1 => {
  const root = [section.kind] as const
  switch (section.kind) {
    case 'identity': {
      const { overview, ...sectionFields } = section
      return {
        ...sectionFields,
        ...(overview === undefined
          ? {}
          : {
              overview: compileFact(overview, [...root, 'overview']),
            }),
        facts: section.facts.map((fact, index) =>
          compileFact(fact, [...root, 'facts', index])
        ),
        languages: section.languages.map((language, index) => ({
          ...language,
          id: structuralId([...root, 'languages', index]),
        })),
      }
    }
    case 'contact':
      return {
        ...section,
        items: section.items.map((item, index) => ({
          ...item,
          id: structuralId([...root, 'items', index]),
        })),
      }
    case 'education':
      return {
        ...section,
        entries: section.entries.map((entry, entryIndex) => {
          const { thesis, ...entryFields } = entry
          return {
            ...entryFields,
            id: structuralId([...root, 'entries', entryIndex]),
            details: entry.details.map((fact, factIndex) =>
              compileFact(fact, [
                ...root,
                'entries',
                entryIndex,
                'details',
                factIndex,
              ])
            ),
            ...(thesis === undefined
              ? {}
              : {
                  thesis: {
                    ...thesis,
                    summary: compileFact(thesis.summary, [
                      ...root,
                      'entries',
                      entryIndex,
                      'thesis',
                      'summary',
                    ]),
                    links: thesis.links.map((link, linkIndex) =>
                      compileLink(link, [
                        ...root,
                        'entries',
                        entryIndex,
                        'thesis',
                        'links',
                        linkIndex,
                      ])
                    ),
                  },
                }),
          }
        }),
      }
    case 'experience':
      return {
        ...section,
        entries: section.entries.map((entry, entryIndex) => {
          const { overview, technologies, workstreams, ...entryFields } = entry
          return {
            ...entryFields,
            id: structuralId([...root, 'entries', entryIndex]),
            technologies: technologies ?? [],
            ...(overview === undefined
              ? {}
              : {
                  overview: compileFact(overview, [
                    ...root,
                    'entries',
                    entryIndex,
                    'overview',
                  ]),
                }),
            highlights: entry.highlights.map((fact, factIndex) =>
              compileFact(fact, [
                ...root,
                'entries',
                entryIndex,
                'highlights',
                factIndex,
              ])
            ),
            workstreams: workstreams.map((workstream, workstreamIndex) => {
              const {
                overview: workstreamOverview,
                technologies: workstreamTechnologies,
                ...workstreamFields
              } = workstream
              return {
                ...workstreamFields,
                id: structuralId([
                  ...root,
                  'entries',
                  entryIndex,
                  'workstreams',
                  workstreamIndex,
                ]),
                technologies: workstreamTechnologies ?? [],
                ...(workstreamOverview === undefined
                  ? {}
                  : {
                      overview: compileFact(workstreamOverview, [
                        ...root,
                        'entries',
                        entryIndex,
                        'workstreams',
                        workstreamIndex,
                        'overview',
                      ]),
                    }),
                contributions: workstream.contributions.map((fact, factIndex) =>
                  compileFact(fact, [
                    ...root,
                    'entries',
                    entryIndex,
                    'workstreams',
                    workstreamIndex,
                    'contributions',
                    factIndex,
                  ])
                ),
              }
            }),
          }
        }),
      }
    case 'projects':
      return {
        ...section,
        entries: section.entries.map((entry, entryIndex) => ({
          ...entry,
          id: structuralId([...root, 'entries', entryIndex]),
          technologies: entry.technologies ?? [],
          summary: compileFact(entry.summary, [
            ...root,
            'entries',
            entryIndex,
            'summary',
          ]),
          links: entry.links.map((link, linkIndex) =>
            compileLink(link, [
              ...root,
              'entries',
              entryIndex,
              'links',
              linkIndex,
            ])
          ),
          contributions: entry.contributions.map(
            (contribution, contributionIndex) => ({
              ...contribution,
              id: structuralId([
                ...root,
                'entries',
                entryIndex,
                'contributions',
                contributionIndex,
              ]),
              facts: contribution.facts.map((fact, factIndex) =>
                compileFact(fact, [
                  ...root,
                  'entries',
                  entryIndex,
                  'contributions',
                  contributionIndex,
                  'facts',
                  factIndex,
                ])
              ),
              technologies: contribution.technologies ?? [],
            })
          ),
        })),
      }
    case 'skills':
      return {
        ...section,
        groups: section.groups.map((group, groupIndex) => ({
          ...group,
          id: structuralId([...root, 'groups', groupIndex]),
          skills: group.skills.map((skill, skillIndex) => {
            const { details, ...skillFields } = skill
            return {
              ...skillFields,
              id: structuralId([
                ...root,
                'groups',
                groupIndex,
                'skills',
                skillIndex,
              ]),
              ...(details === undefined
                ? {}
                : {
                    details: compileFact(details, [
                      ...root,
                      'groups',
                      groupIndex,
                      'skills',
                      skillIndex,
                      'details',
                    ]),
                  }),
            }
          }),
        })),
      }
  }
}

const factShape = (fact: { readonly id: string }) => fact.id

const sectionShape = (section: FactsSectionV1): unknown => {
  switch (section.kind) {
    case 'identity':
      return {
        kind: section.kind,
        overview: section.overview?.id ?? null,
        facts: section.facts.map(factShape),
        languages: section.languages.map(({ id }) => id),
      }
    case 'contact':
      return {
        kind: section.kind,
        items: section.items.map(({ id, kind, visibility }) => ({
          id,
          kind,
          visibility,
        })),
      }
    case 'education':
      return {
        kind: section.kind,
        entries: section.entries.map((entry) => ({
          id: entry.id,
          details: entry.details.map(factShape),
          thesis:
            entry.thesis === undefined
              ? null
              : {
                  summary: entry.thesis.summary.id,
                  links: entry.thesis.links.map(({ id }) => id),
                  assetIds: entry.thesis.assetIds,
                },
        })),
      }
    case 'experience':
      return {
        kind: section.kind,
        entries: section.entries.map((entry) => ({
          id: entry.id,
          technologies: entry.technologies,
          overview: entry.overview?.id ?? null,
          highlights: entry.highlights.map(factShape),
          workstreams: entry.workstreams.map((workstream) => ({
            id: workstream.id,
            technologies: workstream.technologies,
            overview: workstream.overview?.id ?? null,
            contributions: workstream.contributions.map(factShape),
          })),
        })),
      }
    case 'projects':
      return {
        kind: section.kind,
        entries: section.entries.map((entry) => ({
          id: entry.id,
          technologies: entry.technologies,
          summary: entry.summary.id,
          links: entry.links.map(({ id }) => id),
          contributions: entry.contributions.map((contribution) => ({
            id: contribution.id,
            technologies: contribution.technologies,
            facts: contribution.facts.map(factShape),
          })),
        })),
      }
    case 'skills':
      return {
        kind: section.kind,
        groups: section.groups.map((group) => ({
          id: group.id,
          skills: group.skills.map((skill) => ({
            id: skill.id,
            details: skill.details?.id ?? null,
          })),
        })),
      }
  }
}

const catalogueShape = (catalogue: FactsCatalogueV1) =>
  JSON.stringify(catalogue.sections.map(sectionShape))

const assertLocaleParity = (
  baseline: FactsCatalogueV1,
  candidate: FactsCatalogueV1
) =>
  catalogueShape(baseline) === catalogueShape(candidate)
    ? Effect.void
    : Effect.fail(
        compositionFailure(
          `facts/${candidate.locale}`,
          `Section structure or locale-invariant data does not match ${baseline.locale}.`
        )
      )

const decodeSection = (source: FactsSectionModuleSource) =>
  decode(FactSectionSourceSchema, source.value, source.relativePath).pipe(
    Effect.map((section) => ({ section, source }))
  )

export const composeDecodedFactsRepository = Effect.fn(
  'FactsAuthoring.composeDecodedRepository'
)(
  (
    input: DecodedFactsAuthoringCompilationInput
  ): Effect.Effect<
    FactsAuthoringCompilation,
    FactsAuthoringCompositionError | FactsAuthoringValidationError
  > =>
    Effect.gen(function* () {
      const { assets, config, evidence, generationGuidance } = input
      const decodedSections = yield* Effect.forEach(
        input.sections,
        decodeSection
      )
      const compiledAssets = yield* compileAssets(assets, input.assetDigests)
      const compiledEvidence = compileEvidence(evidence)
      const catalogues: FactsCatalogueV1[] = []

      for (const locale of config.locales) {
        const localeSections = decodedSections.filter(
          ({ source }) => source.locale === locale
        )
        if (localeSections.length === 0) {
          return yield* compositionFailure(
            `${config.factsDir}/${locale}`,
            `Configured locale ${locale} has no authored fact sections.`
          )
        }
        const duplicateSection = localeSections.find(
          ({ section }, index) =>
            localeSections.findIndex(
              (candidate) => candidate.section.kind === section.kind
            ) !== index
        )
        if (duplicateSection) {
          return yield* compositionFailure(
            duplicateSection.source.relativePath,
            `Duplicate ${duplicateSection.section.kind} section for locale ${locale}.`
          )
        }
        const catalogue = yield* decode(
          FactsCatalogueV1Schema,
          {
            $schema: 'cv.facts.v1',
            assets: compiledAssets,
            evidence: compiledEvidence,
            locale,
            sections: sortSections(
              localeSections.map(({ section }) => compileSection(section))
            ),
          },
          `catalogue.${locale}`
        )
        catalogues.push(catalogue)
      }

      const baseline = catalogues.find(
        (catalogue) => catalogue.locale === config.defaultLocale
      )
      if (!baseline) {
        return yield* compositionFailure(
          'facts.config.ts',
          `Default locale ${config.defaultLocale} was not compiled.`
        )
      }
      yield* Effect.forEach(
        catalogues.filter((catalogue) => catalogue.locale !== baseline.locale),
        (catalogue) => assertLocaleParity(baseline, catalogue),
        { discard: true }
      )

      return { assets, catalogues, config, evidence, generationGuidance }
    })
)

export const composeFactsRepository = Effect.fn(
  'FactsAuthoring.composeRepository'
)((input: FactsAuthoringCompilationInput) =>
  Effect.gen(function* () {
    const config = yield* decodeFactsRepositoryConfig(input.config)
    const evidence = yield* decodeFactEvidenceRegistry(
      input.evidence,
      `${config.factsDir}/evidence.ts`
    )
    const assets = yield* decodeFactAssetRegistry(
      input.assets,
      `${config.factsDir}/assets.ts`
    )
    const generationGuidance: CvGenerationGuidanceSource =
      yield* decodeCvGenerationGuidance(
        input.generationGuidance,
        config.generationGuidance
      )
    return yield* composeDecodedFactsRepository({
      ...input,
      assets,
      config,
      evidence,
      generationGuidance,
    })
  })
)
