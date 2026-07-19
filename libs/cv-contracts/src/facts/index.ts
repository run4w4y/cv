import { Option, Schema } from 'effect'
import {
  type GenerationGuidance,
  GenerationGuidanceAnnotationId,
} from '../guidance'
import {
  CvLocaleSchema,
  NonEmptyTextSchema,
  Sha256HexSchema,
  ShortTextSchema,
  StableIdentifierSchema,
  UriSchema,
} from '../internal/primitives'

export {
  type GenerationGuidance,
  GenerationGuidanceAnnotationId,
  type GenerationGuidanceSource,
  generationGuidanceSourceValues,
  getGenerationGuidance,
} from '../guidance'
export { CvLocaleSchema } from '../internal/primitives'

export type CvLocale = Schema.Schema.Type<typeof CvLocaleSchema>

export const cvFactsV1ContractId = 'cv.facts.v1' as const
export const cvFactsV1Version = 1 as const

export const cvFactsV1AuthoringGuidance = {
  instruction:
    'Publish a complete, human-reviewed account of the person, their work, and their projects. Preserve domain structure instead of pre-tailoring facts for a particular role.',
  sources: ['human-reviewed'],
  rules: [
    'Author one canonical fact once and let the generation workflow select relevant material for an opening.',
    'Use sections, entries, workstreams, and contribution groups for meaning; do not encode grouping or target roles as generic tags.',
    'Compiler-generated structural IDs identify facts and entries across locales; authors do not maintain internal IDs by hand.',
    'Tailoring guidance may permit selection, reordering, paraphrasing, or summarization, but it may never permit invented facts.',
    'Evidence and private assets are audit context and are excluded from model generation input.',
  ],
} as const satisfies GenerationGuidance & {
  readonly rules: ReadonlyArray<string>
}

const FactTextSchema = NonEmptyTextSchema.pipe(
  Schema.check(Schema.isMaxLength(4_000))
)

const FactListSchema = <S extends Schema.Top>(schema: S, maxLength: number) =>
  Schema.Array(schema).pipe(Schema.check(Schema.isMaxLength(maxLength)))

export const FactTailoringGuidanceV1Schema = Schema.Struct({
  inclusion: Schema.optionalKey(
    Schema.Literals(['always', 'when-relevant', 'optional'])
  ),
  wording: Schema.optionalKey(
    Schema.Literals(['verbatim', 'paraphrase', 'summarize'])
  ),
  instructions: Schema.optionalKey(FactListSchema(FactTextSchema, 16)),
}).annotate({
  identifier: 'FactTailoringGuidanceV1',
  title: 'Tailoring guidance',
  description:
    'Human-authored limits on selection and wording for a section or fact.',
})

export interface FactTailoringGuidanceV1
  extends Schema.Schema.Type<typeof FactTailoringGuidanceV1Schema> {}

export const ReviewedFactV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  text: FactTextSchema.annotate({
    title: 'Reviewed fact',
    [GenerationGuidanceAnnotationId]: {
      instruction:
        'Use only this reviewed meaning. Do not add scope, ownership, technologies, quantities, or outcomes that are not stated.',
      sources: ['human-reviewed'],
    } satisfies GenerationGuidance,
  }),
  evidenceIds: Schema.optionalKey(FactListSchema(StableIdentifierSchema, 12)),
  assetIds: Schema.optionalKey(FactListSchema(StableIdentifierSchema, 12)),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
}).annotate({
  identifier: 'ReviewedFactV1',
  title: 'Reviewed fact',
})

export interface ReviewedFactV1
  extends Schema.Schema.Type<typeof ReviewedFactV1Schema> {}

export const FactLinkV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  label: ShortTextSchema,
  url: UriSchema,
  visibility: Schema.optionalKey(Schema.Literals(['public', 'private'])),
}).annotate({ identifier: 'FactLinkV1', title: 'Reviewed link' })

export interface FactLinkV1
  extends Schema.Schema.Type<typeof FactLinkV1Schema> {}

export const FactEvidenceV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  kind: Schema.Literals([
    'primary-source',
    'public-source',
    'private-source',
    'personal-review',
  ]),
  title: ShortTextSchema,
  uri: Schema.optionalKey(UriSchema),
  note: Schema.optionalKey(
    NonEmptyTextSchema.pipe(Schema.check(Schema.isMaxLength(1_000)))
  ),
}).annotate({ identifier: 'FactEvidenceV1', title: 'Fact evidence' })

export interface FactEvidenceV1
  extends Schema.Schema.Type<typeof FactEvidenceV1Schema> {}

export const FactAssetV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  label: ShortTextSchema,
  description: NonEmptyTextSchema.pipe(Schema.check(Schema.isMaxLength(1_000))),
  mediaType: Schema.String.pipe(
    Schema.check(
      Schema.isPattern(
        /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[^\s=]+=[^;]+)*$/iu
      )
    )
  ),
  sha256: Sha256HexSchema,
}).annotate({ identifier: 'FactAssetV1', title: 'Facts asset' })

export interface FactAssetV1
  extends Schema.Schema.Type<typeof FactAssetV1Schema> {}

export const IdentityLanguageV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  name: ShortTextSchema,
  proficiency: Schema.optionalKey(ShortTextSchema),
})

export interface IdentityLanguageV1
  extends Schema.Schema.Type<typeof IdentityLanguageV1Schema> {}

export const IdentityFactsSectionV1Schema = Schema.Struct({
  kind: Schema.Literal('identity'),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
  name: ShortTextSchema,
  handle: Schema.optionalKey(ShortTextSchema),
  location: Schema.optionalKey(ShortTextSchema),
  timezone: Schema.optionalKey(ShortTextSchema),
  headline: Schema.optionalKey(ShortTextSchema),
  overview: Schema.optionalKey(ReviewedFactV1Schema),
  facts: FactListSchema(ReviewedFactV1Schema, 128),
  languages: FactListSchema(IdentityLanguageV1Schema, 32),
}).annotate({ identifier: 'IdentityFactsSectionV1' })

export interface IdentityFactsSectionV1
  extends Schema.Schema.Type<typeof IdentityFactsSectionV1Schema> {}

export const ContactItemV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  kind: Schema.Literals(['email', 'phone', 'telegram', 'website', 'social']),
  label: Schema.optionalKey(ShortTextSchema),
  value: ShortTextSchema,
  url: Schema.optionalKey(UriSchema),
  visibility: Schema.Literals(['public', 'private']),
})

export interface ContactItemV1
  extends Schema.Schema.Type<typeof ContactItemV1Schema> {}

export const ContactFactsSectionV1Schema = Schema.Struct({
  kind: Schema.Literal('contact'),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
  items: FactListSchema(ContactItemV1Schema, 32),
}).annotate({ identifier: 'ContactFactsSectionV1' })

export interface ContactFactsSectionV1
  extends Schema.Schema.Type<typeof ContactFactsSectionV1Schema> {}

export const EducationThesisV1Schema = Schema.Struct({
  title: ShortTextSchema,
  summary: ReviewedFactV1Schema,
  links: FactListSchema(FactLinkV1Schema, 16),
  assetIds: FactListSchema(StableIdentifierSchema, 12),
})

export interface EducationThesisV1
  extends Schema.Schema.Type<typeof EducationThesisV1Schema> {}

export const EducationEntryV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  institution: ShortTextSchema,
  degree: ShortTextSchema,
  location: Schema.optionalKey(ShortTextSchema),
  period: ShortTextSchema,
  details: FactListSchema(ReviewedFactV1Schema, 64),
  thesis: Schema.optionalKey(EducationThesisV1Schema),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
})

export interface EducationEntryV1
  extends Schema.Schema.Type<typeof EducationEntryV1Schema> {}

export const EducationFactsSectionV1Schema = Schema.Struct({
  kind: Schema.Literal('education'),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
  entries: FactListSchema(EducationEntryV1Schema, 32),
}).annotate({ identifier: 'EducationFactsSectionV1' })

export interface EducationFactsSectionV1
  extends Schema.Schema.Type<typeof EducationFactsSectionV1Schema> {}

export const ExperienceWorkstreamV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  title: ShortTextSchema,
  overview: Schema.optionalKey(ReviewedFactV1Schema),
  contributions: FactListSchema(ReviewedFactV1Schema, 128),
  technologies: FactListSchema(ShortTextSchema, 128),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
})

export interface ExperienceWorkstreamV1
  extends Schema.Schema.Type<typeof ExperienceWorkstreamV1Schema> {}

export const ExperienceEntryV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  company: ShortTextSchema,
  companyVisibility: Schema.Literals(['public', 'private']),
  location: Schema.optionalKey(ShortTextSchema),
  period: ShortTextSchema,
  roles: FactListSchema(ShortTextSchema, 16),
  overview: Schema.optionalKey(ReviewedFactV1Schema),
  highlights: FactListSchema(ReviewedFactV1Schema, 256),
  workstreams: FactListSchema(ExperienceWorkstreamV1Schema, 128),
  technologies: FactListSchema(ShortTextSchema, 256),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
})

export interface ExperienceEntryV1
  extends Schema.Schema.Type<typeof ExperienceEntryV1Schema> {}

export const ExperienceFactsSectionV1Schema = Schema.Struct({
  kind: Schema.Literal('experience'),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
  entries: FactListSchema(ExperienceEntryV1Schema, 64),
}).annotate({ identifier: 'ExperienceFactsSectionV1' })

export interface ExperienceFactsSectionV1
  extends Schema.Schema.Type<typeof ExperienceFactsSectionV1Schema> {}

export const ProjectContributionV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  title: ShortTextSchema,
  area: Schema.optionalKey(
    Schema.Literals([
      'backend',
      'frontend',
      'infrastructure',
      'tooling',
      'research',
      'product',
      'general',
    ])
  ),
  facts: FactListSchema(ReviewedFactV1Schema, 128),
  technologies: FactListSchema(ShortTextSchema, 128),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
})

export interface ProjectContributionV1
  extends Schema.Schema.Type<typeof ProjectContributionV1Schema> {}

export const ProjectEntryV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  name: ShortTextSchema,
  visibility: Schema.Literals(['public', 'private']),
  summary: ReviewedFactV1Schema,
  links: FactListSchema(FactLinkV1Schema, 16),
  contributions: FactListSchema(ProjectContributionV1Schema, 128),
  technologies: FactListSchema(ShortTextSchema, 256),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
})

export interface ProjectEntryV1
  extends Schema.Schema.Type<typeof ProjectEntryV1Schema> {}

export const ProjectsFactsSectionV1Schema = Schema.Struct({
  kind: Schema.Literal('projects'),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
  entries: FactListSchema(ProjectEntryV1Schema, 128),
}).annotate({ identifier: 'ProjectsFactsSectionV1' })

export interface ProjectsFactsSectionV1
  extends Schema.Schema.Type<typeof ProjectsFactsSectionV1Schema> {}

export const SkillEntryV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  name: ShortTextSchema,
  details: Schema.optionalKey(ReviewedFactV1Schema),
})

export interface SkillEntryV1
  extends Schema.Schema.Type<typeof SkillEntryV1Schema> {}

export const SkillGroupV1Schema = Schema.Struct({
  id: StableIdentifierSchema,
  title: ShortTextSchema,
  skills: FactListSchema(SkillEntryV1Schema, 256),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
})

export interface SkillGroupV1
  extends Schema.Schema.Type<typeof SkillGroupV1Schema> {}

export const SkillsFactsSectionV1Schema = Schema.Struct({
  kind: Schema.Literal('skills'),
  guidance: Schema.optionalKey(FactTailoringGuidanceV1Schema),
  groups: FactListSchema(SkillGroupV1Schema, 64),
}).annotate({ identifier: 'SkillsFactsSectionV1' })

export interface SkillsFactsSectionV1
  extends Schema.Schema.Type<typeof SkillsFactsSectionV1Schema> {}

export const FactsSectionV1Schema = Schema.Union([
  IdentityFactsSectionV1Schema,
  ContactFactsSectionV1Schema,
  EducationFactsSectionV1Schema,
  ExperienceFactsSectionV1Schema,
  ProjectsFactsSectionV1Schema,
  SkillsFactsSectionV1Schema,
]).annotate({ identifier: 'FactsSectionV1' })

export type FactsSectionV1 = Schema.Schema.Type<typeof FactsSectionV1Schema>

export const FactsCatalogueV1StructureSchema = Schema.Struct({
  $schema: Schema.Literal(cvFactsV1ContractId),
  locale: CvLocaleSchema,
  sections: FactListSchema(FactsSectionV1Schema, 16).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  evidence: Schema.Array(FactEvidenceV1Schema),
  assets: Schema.Array(FactAssetV1Schema),
})

export interface FactsCatalogueV1Structure
  extends Schema.Schema.Type<typeof FactsCatalogueV1StructureSchema> {}

type LocatedFact = {
  readonly fact: ReviewedFactV1
  readonly path: ReadonlyArray<string | number>
}

const optionalFact = (
  fact: ReviewedFactV1 | undefined,
  path: ReadonlyArray<string | number>
): ReadonlyArray<LocatedFact> => (fact === undefined ? [] : [{ fact, path }])

const collectSectionFacts = (
  section: FactsSectionV1,
  sectionIndex: number
): ReadonlyArray<LocatedFact> => {
  const root = ['sections', sectionIndex] as const
  switch (section.kind) {
    case 'identity':
      return [
        ...optionalFact(section.overview, [...root, 'overview']),
        ...section.facts.map((fact, index) => ({
          fact,
          path: [...root, 'facts', index],
        })),
      ]
    case 'contact':
      return []
    case 'education':
      return section.entries.flatMap((entry, entryIndex) => [
        ...entry.details.map((fact, factIndex) => ({
          fact,
          path: [...root, 'entries', entryIndex, 'details', factIndex],
        })),
        ...optionalFact(entry.thesis?.summary, [
          ...root,
          'entries',
          entryIndex,
          'thesis',
          'summary',
        ]),
      ])
    case 'experience':
      return section.entries.flatMap((entry, entryIndex) => [
        ...optionalFact(entry.overview, [
          ...root,
          'entries',
          entryIndex,
          'overview',
        ]),
        ...entry.highlights.map((fact, factIndex) => ({
          fact,
          path: [...root, 'entries', entryIndex, 'highlights', factIndex],
        })),
        ...entry.workstreams.flatMap((workstream, workstreamIndex) => [
          ...optionalFact(workstream.overview, [
            ...root,
            'entries',
            entryIndex,
            'workstreams',
            workstreamIndex,
            'overview',
          ]),
          ...workstream.contributions.map((fact, factIndex) => ({
            fact,
            path: [
              ...root,
              'entries',
              entryIndex,
              'workstreams',
              workstreamIndex,
              'contributions',
              factIndex,
            ],
          })),
        ]),
      ])
    case 'projects':
      return section.entries.flatMap((entry, entryIndex) => [
        {
          fact: entry.summary,
          path: [...root, 'entries', entryIndex, 'summary'],
        },
        ...entry.contributions.flatMap((contribution, contributionIndex) =>
          contribution.facts.map((fact, factIndex) => ({
            fact,
            path: [
              ...root,
              'entries',
              entryIndex,
              'contributions',
              contributionIndex,
              'facts',
              factIndex,
            ],
          }))
        ),
      ])
    case 'skills':
      return section.groups.flatMap((group, groupIndex) =>
        group.skills.flatMap((skill, skillIndex) =>
          optionalFact(skill.details, [
            ...root,
            'groups',
            groupIndex,
            'skills',
            skillIndex,
            'details',
          ])
        )
      )
  }
}

const duplicateIdIssues = (
  values: ReadonlyArray<{
    readonly id: string
    readonly path: ReadonlyArray<string | number>
  }>,
  label: string
): ReadonlyArray<Schema.FilterIssue> => {
  const seen = new Set<string>()
  return values.flatMap(({ id, path }) => {
    if (seen.has(id))
      return [{ path: [...path, 'id'], issue: `Duplicate ${label} ID: ${id}` }]
    seen.add(id)
    return []
  })
}

const sectionStructureIssues = (
  section: FactsSectionV1,
  sectionIndex: number
): ReadonlyArray<Schema.FilterIssue> => {
  const root = ['sections', sectionIndex] as const
  switch (section.kind) {
    case 'identity':
      return duplicateIdIssues(
        section.languages.map(({ id }, index) => ({
          id,
          path: [...root, 'languages', index],
        })),
        'language'
      )
    case 'contact':
      return duplicateIdIssues(
        section.items.map(({ id }, index) => ({
          id,
          path: [...root, 'items', index],
        })),
        'contact item'
      )
    case 'education':
      return [
        ...duplicateIdIssues(
          section.entries.map(({ id }, index) => ({
            id,
            path: [...root, 'entries', index],
          })),
          'education entry'
        ),
        ...section.entries.flatMap((entry, entryIndex) =>
          duplicateIdIssues(
            (entry.thesis?.links ?? []).map(({ id }, linkIndex) => ({
              id,
              path: [
                ...root,
                'entries',
                entryIndex,
                'thesis',
                'links',
                linkIndex,
              ],
            })),
            'education link'
          )
        ),
      ]
    case 'experience':
      return [
        ...duplicateIdIssues(
          section.entries.map(({ id }, index) => ({
            id,
            path: [...root, 'entries', index],
          })),
          'experience entry'
        ),
        ...section.entries.flatMap((entry, entryIndex) =>
          duplicateIdIssues(
            entry.workstreams.map(({ id }, workstreamIndex) => ({
              id,
              path: [
                ...root,
                'entries',
                entryIndex,
                'workstreams',
                workstreamIndex,
              ],
            })),
            'workstream'
          )
        ),
      ]
    case 'projects':
      return [
        ...duplicateIdIssues(
          section.entries.map(({ id }, index) => ({
            id,
            path: [...root, 'entries', index],
          })),
          'project'
        ),
        ...section.entries.flatMap((entry, entryIndex) => [
          ...duplicateIdIssues(
            entry.links.map(({ id }, linkIndex) => ({
              id,
              path: [...root, 'entries', entryIndex, 'links', linkIndex],
            })),
            'project link'
          ),
          ...duplicateIdIssues(
            entry.contributions.map(({ id }, contributionIndex) => ({
              id,
              path: [
                ...root,
                'entries',
                entryIndex,
                'contributions',
                contributionIndex,
              ],
            })),
            'project contribution'
          ),
        ]),
      ]
    case 'skills':
      return [
        ...duplicateIdIssues(
          section.groups.map(({ id }, index) => ({
            id,
            path: [...root, 'groups', index],
          })),
          'skill group'
        ),
        ...section.groups.flatMap((group, groupIndex) =>
          duplicateIdIssues(
            group.skills.map(({ id }, skillIndex) => ({
              id,
              path: [...root, 'groups', groupIndex, 'skills', skillIndex],
            })),
            'skill'
          )
        ),
      ]
  }
}

export const inspectFactsCatalogueV1Integrity = (
  catalogue: FactsCatalogueV1Structure
): ReadonlyArray<Schema.FilterIssue> => {
  const locatedFacts = catalogue.sections.flatMap(collectSectionFacts)
  const evidenceIds = new Set(catalogue.evidence.map(({ id }) => id))
  const assetIds = new Set(catalogue.assets.map(({ id }) => id))
  return [
    ...duplicateIdIssues(
      catalogue.sections.map((section, index) => ({
        id: section.kind,
        path: ['sections', index],
      })),
      'section'
    ),
    ...duplicateIdIssues(
      catalogue.evidence.map((evidence, index) => ({
        id: evidence.id,
        path: ['evidence', index],
      })),
      'evidence'
    ),
    ...duplicateIdIssues(
      catalogue.assets.map((asset, index) => ({
        id: asset.id,
        path: ['assets', index],
      })),
      'asset'
    ),
    ...duplicateIdIssues(
      locatedFacts.map(({ fact, path }) => ({ id: fact.id, path })),
      'fact'
    ),
    ...catalogue.sections.flatMap(sectionStructureIssues),
    ...locatedFacts.flatMap(({ fact, path }) => [
      ...(fact.evidenceIds ?? []).flatMap((id, index) =>
        evidenceIds.has(id)
          ? []
          : [
              {
                path: [...path, 'evidenceIds', index],
                issue: `Unknown evidence reference: ${id}`,
              },
            ]
      ),
      ...(fact.assetIds ?? []).flatMap((id, index) =>
        assetIds.has(id)
          ? []
          : [
              {
                path: [...path, 'assetIds', index],
                issue: `Unknown asset reference: ${id}`,
              },
            ]
      ),
    ]),
    ...catalogue.sections.flatMap((section, sectionIndex) =>
      section.kind === 'education'
        ? section.entries.flatMap((entry, entryIndex) =>
            (entry.thesis?.assetIds ?? []).flatMap((id, assetIndex) =>
              assetIds.has(id)
                ? []
                : [
                    {
                      path: [
                        'sections',
                        sectionIndex,
                        'entries',
                        entryIndex,
                        'thesis',
                        'assetIds',
                        assetIndex,
                      ],
                      issue: `Unknown asset reference: ${id}`,
                    },
                  ]
            )
          )
        : []
    ),
  ]
}

export const FactsCatalogueV1Schema = FactsCatalogueV1StructureSchema.pipe(
  Schema.check(
    Schema.makeFilter(inspectFactsCatalogueV1Integrity, {
      description:
        'A hierarchical facts catalogue with unique stable IDs and valid evidence and asset references.',
    })
  )
).annotate({
  identifier: 'FactsCatalogueV1',
  title: 'CV facts catalogue v1',
  description:
    'A generated single-locale catalogue of complete, structured, human-reviewed facts.',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
  [GenerationGuidanceAnnotationId]: cvFactsV1AuthoringGuidance,
})

export type FactsCatalogueV1 = Schema.Schema.Type<typeof FactsCatalogueV1Schema>
export type FactsCatalogueV1Encoded = Schema.Codec.Encoded<
  typeof FactsCatalogueV1Schema
>

export const FactsCatalogueSchema = FactsCatalogueV1Schema
export type FactsCatalogue = Schema.Schema.Type<typeof FactsCatalogueSchema>

export const factsSchemaRegistry = [
  {
    contractId: cvFactsV1ContractId,
    version: cvFactsV1Version,
    schema: FactsCatalogueV1Schema,
    authoringGuidance: cvFactsV1AuthoringGuidance,
  },
] as const

export type FactsContractId = (typeof factsSchemaRegistry)[number]['contractId']

export const getFactsContract = (contractId: string) =>
  contractId === cvFactsV1ContractId
    ? Option.some(factsSchemaRegistry[0])
    : Option.none()
