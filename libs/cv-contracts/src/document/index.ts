import { Option, Schema } from 'effect'
import {
  type GenerationGuidance,
  GenerationGuidanceAnnotationId,
} from '../guidance'
import {
  CvLocaleSchema,
  NonEmptyTextSchema,
  ShortTextSchema,
  StableIdentifierSchema,
  UriSchema,
} from '../internal/primitives'

export {
  collectGenerationGuidance,
  type GenerationGuidance,
  GenerationGuidanceAnnotationId,
  type GenerationGuidanceItem,
  type GenerationGuidanceSource,
  generationGuidanceSourceValues,
  getGenerationGuidance,
} from '../guidance'

export const cvDocumentV1ContractId = 'cv.document.v1' as const
export const cvDocumentV1Version = 1 as const

export const cvDocumentV1GenerationGuidance = {
  instruction:
    'Produce a truthful, concise one-page CV. Use the job context only to select, order, and emphasize relevant material; every factual claim must be supported by the trusted facts catalogue.',
  sources: ['trusted-facts', 'job-context'],
  rules: [
    'Never invent employers, dates, skills, metrics, qualifications, links, or responsibilities.',
    'Prefer concrete evidence and outcomes over generic self-description.',
    'Use exactly the requested locale and keep every section concise enough for one-page rendering.',
    'Return only data accepted by this schema; renderer-owned labels, QR links, navigation, and print controls are not document content.',
  ],
} as const satisfies GenerationGuidance & {
  readonly rules: ReadonlyArray<string>
}

const HeadlineSchema = ShortTextSchema.annotate({
  title: 'Headline',
  description: 'A short role-focused professional headline.',
  [GenerationGuidanceAnnotationId]: {
    instruction:
      'Tailor the headline to the role without claiming a title or speciality unsupported by the trusted facts.',
    sources: ['trusted-facts', 'job-context'],
    maxWords: 14,
  } satisfies GenerationGuidance,
})

const SummarySchema = NonEmptyTextSchema.pipe(
  Schema.check(Schema.isMaxLength(1_200))
).annotate({
  title: 'Professional summary',
  description: 'A compact role-specific professional summary.',
  [GenerationGuidanceAnnotationId]: {
    instruction:
      'Write a compact opening that aligns verified strengths with the role. Do not repeat the job description or introduce unsupported claims.',
    sources: ['trusted-facts', 'job-context'],
    maxWords: 90,
  } satisfies GenerationGuidance,
})

const HighlightSchema = NonEmptyTextSchema.pipe(
  Schema.check(Schema.isMaxLength(500))
).annotate({
  title: 'Highlight',
  description: 'A concise, evidence-backed accomplishment or responsibility.',
  [GenerationGuidanceAnnotationId]: {
    instruction:
      'Select or faithfully rephrase a supported accomplishment. Preserve the meaning and all quantities from the trusted fact.',
    sources: ['trusted-facts', 'job-context'],
    maxWords: 30,
  } satisfies GenerationGuidance,
})

const TechnologySchema = ShortTextSchema.pipe(
  Schema.check(Schema.isMaxLength(80))
).annotate({
  title: 'Technology',
  description: 'A technology, tool, method, or domain skill.',
  [GenerationGuidanceAnnotationId]: {
    instruction:
      'Include only a technology explicitly supported by the trusted facts catalogue.',
    sources: ['trusted-facts'],
    maxWords: 5,
  } satisfies GenerationGuidance,
})

export const CvContactLinkV1Schema = Schema.Struct({
  kind: Schema.Literals([
    'email',
    'phone',
    'website',
    'github',
    'linkedin',
    'other',
  ]).annotate({
    title: 'Contact kind',
    description: 'Renderer hint for a contact method.',
  }),
  label: ShortTextSchema.annotate({
    title: 'Contact label',
    description: 'Short human-readable label for the contact method.',
  }),
  value: ShortTextSchema.annotate({
    title: 'Contact value',
    description: 'The exact contact value shown to the reader.',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Copy the exact approved contact value from trusted facts.',
      sources: ['trusted-facts'],
      maxWords: 12,
    } satisfies GenerationGuidance,
  }),
  href: Schema.optional(
    UriSchema.annotate({
      title: 'Contact link',
      description: 'Absolute URI opened for this contact method.',
      [GenerationGuidanceAnnotationId]: {
        instruction: 'Copy the exact approved URI from trusted facts.',
        sources: ['trusted-facts'],
      } satisfies GenerationGuidance,
    })
  ),
}).annotate({
  identifier: 'CvContactLinkV1',
  title: 'Contact link',
  description: 'One public contact or profile link.',
})

export type CvContactLinkV1 = Schema.Schema.Type<typeof CvContactLinkV1Schema>

export const CvPersonV1Schema = Schema.Struct({
  name: ShortTextSchema.annotate({
    title: 'Name',
    description: 'The person name displayed as the document title.',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Copy the approved display name exactly from trusted facts.',
      sources: ['trusted-facts'],
      maxWords: 8,
    } satisfies GenerationGuidance,
  }),
  headline: HeadlineSchema,
  location: Schema.optional(
    ShortTextSchema.annotate({
      title: 'Location',
      description: 'Public location or remote-work location statement.',
      [GenerationGuidanceAnnotationId]: {
        instruction:
          'Use only an approved location statement from trusted facts.',
        sources: ['trusted-facts'],
        maxWords: 12,
      } satisfies GenerationGuidance,
    })
  ),
  summary: SummarySchema,
  contacts: Schema.Array(CvContactLinkV1Schema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(8))
  ),
}).annotate({
  identifier: 'CvPersonV1',
  title: 'Person',
  description: 'Identity, headline, summary, and public contact details.',
})

export type CvPersonV1 = Schema.Schema.Type<typeof CvPersonV1Schema>

export const CvExperienceItemV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({
    title: 'Experience ID',
    description: 'Stable item identifier used by the editor and renderer.',
  }),
  company: ShortTextSchema.annotate({
    title: 'Company',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Copy the approved employer name from trusted facts.',
      sources: ['trusted-facts'],
      maxWords: 10,
    } satisfies GenerationGuidance,
  }),
  role: ShortTextSchema.annotate({
    title: 'Role',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Copy the approved role title from trusted facts.',
      sources: ['trusted-facts'],
      maxWords: 12,
    } satisfies GenerationGuidance,
  }),
  period: ShortTextSchema.annotate({
    title: 'Period',
    description: 'Human-readable employment period.',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Preserve the approved dates exactly.',
      sources: ['trusted-facts'],
      maxWords: 8,
    } satisfies GenerationGuidance,
  }),
  location: Schema.optional(
    ShortTextSchema.annotate({
      title: 'Location',
      [GenerationGuidanceAnnotationId]: {
        instruction:
          'Use the approved employment location or work-mode wording.',
        sources: ['trusted-facts'],
        maxWords: 10,
      } satisfies GenerationGuidance,
    })
  ),
  summary: Schema.optional(
    NonEmptyTextSchema.pipe(Schema.check(Schema.isMaxLength(800))).annotate({
      title: 'Experience summary',
      [GenerationGuidanceAnnotationId]: {
        instruction:
          'Summarize the scope of the role using only supported responsibilities, emphasizing relevance to the target role.',
        sources: ['trusted-facts', 'job-context'],
        maxWords: 45,
      } satisfies GenerationGuidance,
    })
  ),
  highlights: Schema.Array(HighlightSchema).pipe(
    Schema.check(Schema.isMaxLength(7))
  ),
  technologies: Schema.Array(TechnologySchema).pipe(
    Schema.check(Schema.isMaxLength(16))
  ),
}).annotate({
  identifier: 'CvExperienceItemV1',
  title: 'Experience item',
  description: 'One selected employment entry.',
})

export type CvExperienceItemV1 = Schema.Schema.Type<
  typeof CvExperienceItemV1Schema
>

export const CvProjectItemV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({ title: 'Project ID' }),
  name: ShortTextSchema.annotate({
    title: 'Project name',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Copy the approved project name from trusted facts.',
      sources: ['trusted-facts'],
      maxWords: 12,
    } satisfies GenerationGuidance,
  }),
  summary: NonEmptyTextSchema.pipe(
    Schema.check(Schema.isMaxLength(800))
  ).annotate({
    title: 'Project summary',
    [GenerationGuidanceAnnotationId]: {
      instruction:
        'Explain the project and verified contribution concisely, emphasizing the aspects most relevant to the job.',
      sources: ['trusted-facts', 'job-context'],
      maxWords: 55,
    } satisfies GenerationGuidance,
  }),
  highlights: Schema.Array(HighlightSchema).pipe(
    Schema.check(Schema.isMaxLength(5))
  ),
  technologies: Schema.Array(TechnologySchema).pipe(
    Schema.check(Schema.isMaxLength(16))
  ),
  links: Schema.Array(CvContactLinkV1Schema).pipe(
    Schema.check(Schema.isMaxLength(4))
  ),
}).annotate({
  identifier: 'CvProjectItemV1',
  title: 'Project item',
  description: 'One selected project.',
})

export type CvProjectItemV1 = Schema.Schema.Type<typeof CvProjectItemV1Schema>

export const CvSkillGroupV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({ title: 'Skill group ID' }),
  label: ShortTextSchema.annotate({
    title: 'Skill group label',
    [GenerationGuidanceAnnotationId]: {
      instruction:
        'Use a concise grouping label that accurately describes the included verified skills.',
      sources: ['trusted-facts', 'job-context'],
      maxWords: 5,
    } satisfies GenerationGuidance,
  }),
  items: Schema.Array(TechnologySchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(24))
  ),
}).annotate({
  identifier: 'CvSkillGroupV1',
  title: 'Skill group',
  description: 'A compact category of verified skills.',
})

export type CvSkillGroupV1 = Schema.Schema.Type<typeof CvSkillGroupV1Schema>

export const CvEducationItemV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({ title: 'Education ID' }),
  institution: ShortTextSchema.annotate({
    title: 'Institution',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Copy the approved institution name from trusted facts.',
      sources: ['trusted-facts'],
      maxWords: 16,
    } satisfies GenerationGuidance,
  }),
  qualification: ShortTextSchema.annotate({
    title: 'Qualification',
    [GenerationGuidanceAnnotationId]: {
      instruction:
        'Copy the approved degree, programme, or qualification from trusted facts.',
      sources: ['trusted-facts'],
      maxWords: 18,
    } satisfies GenerationGuidance,
  }),
  period: ShortTextSchema.annotate({
    title: 'Period',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Preserve the approved education dates exactly.',
      sources: ['trusted-facts'],
      maxWords: 8,
    } satisfies GenerationGuidance,
  }),
  location: Schema.optional(ShortTextSchema.annotate({ title: 'Location' })),
  details: Schema.Array(HighlightSchema).pipe(
    Schema.check(Schema.isMaxLength(4))
  ),
}).annotate({
  identifier: 'CvEducationItemV1',
  title: 'Education item',
  description: 'One selected education or qualification entry.',
})

export type CvEducationItemV1 = Schema.Schema.Type<
  typeof CvEducationItemV1Schema
>

export const CvAdditionalItemV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({ title: 'Additional item ID' }),
  title: Schema.optional(ShortTextSchema.annotate({ title: 'Item title' })),
  text: NonEmptyTextSchema.pipe(Schema.check(Schema.isMaxLength(500))).annotate(
    {
      title: 'Item text',
      [GenerationGuidanceAnnotationId]: {
        instruction:
          'Include a concise statement supported by trusted facts. Use job context only to decide relevance and emphasis.',
        sources: ['trusted-facts', 'job-context'],
        maxWords: 35,
      } satisfies GenerationGuidance,
    }
  ),
}).annotate({
  identifier: 'CvAdditionalItemV1',
  title: 'Additional item',
})

export const CvAdditionalSectionV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({ title: 'Section ID' }),
  title: ShortTextSchema.annotate({ title: 'Section title' }),
  items: Schema.Array(CvAdditionalItemV1Schema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(8))
  ),
}).annotate({
  identifier: 'CvAdditionalSectionV1',
  title: 'Additional section',
  description:
    'A compact optional section for verified languages, certifications, awards, or similar material.',
})

export type CvAdditionalSectionV1 = Schema.Schema.Type<
  typeof CvAdditionalSectionV1Schema
>

const CvDocumentV1StructureSchema = Schema.Struct({
  $schema: Schema.Literal(cvDocumentV1ContractId).annotate({
    title: 'Contract ID',
    description: 'Immutable identifier of the document contract version.',
  }),
  locale: CvLocaleSchema.annotate({
    title: 'Locale',
    description: 'Single locale used throughout this document.',
    [GenerationGuidanceAnnotationId]: {
      instruction:
        'Use the requested facts locale and write every human-readable field in that locale.',
      sources: ['literal'],
    } satisfies GenerationGuidance,
  }),
  direction: Schema.Literal('ltr').annotate({
    title: 'Text direction',
    description: 'Text direction used by the renderer.',
    [GenerationGuidanceAnnotationId]: {
      instruction: 'Choose the direction implied by the requested locale.',
      sources: ['literal'],
    } satisfies GenerationGuidance,
  }),
  person: CvPersonV1Schema,
  experience: Schema.Array(CvExperienceItemV1Schema).pipe(
    Schema.check(Schema.isMaxLength(10))
  ),
  projects: Schema.Array(CvProjectItemV1Schema).pipe(
    Schema.check(Schema.isMaxLength(8))
  ),
  skills: Schema.Array(CvSkillGroupV1Schema).pipe(
    Schema.check(Schema.isMaxLength(10))
  ),
  education: Schema.Array(CvEducationItemV1Schema).pipe(
    Schema.check(Schema.isMaxLength(6))
  ),
  additionalSections: Schema.Array(CvAdditionalSectionV1Schema).pipe(
    Schema.check(Schema.isMaxLength(6))
  ),
})

const duplicateItemIssues = (
  items: ReadonlyArray<{ readonly id: string }>,
  path: string
): ReadonlyArray<Schema.FilterIssue> => {
  const seen = new Set<string>()
  return items.flatMap((item, index) => {
    if (seen.has(item.id)) {
      return [
        {
          path: [path, index, 'id'],
          issue: `Duplicate item identifier: ${item.id}`,
        },
      ]
    }
    seen.add(item.id)
    return []
  })
}

export const CvDocumentV1Schema = CvDocumentV1StructureSchema.pipe(
  Schema.check(
    Schema.makeFilter(
      (document) => [
        ...duplicateItemIssues(document.experience, 'experience'),
        ...duplicateItemIssues(document.projects, 'projects'),
        ...duplicateItemIssues(document.skills, 'skills'),
        ...duplicateItemIssues(document.education, 'education'),
        ...duplicateItemIssues(
          document.additionalSections,
          'additionalSections'
        ),
      ],
      {
        description: 'A one-page CV with unique item identifiers.',
      }
    )
  )
).annotate({
  identifier: 'CvDocumentV1',
  title: 'CV document v1',
  description:
    'Flattened, single-locale content rendered as a one-page tailored CV.',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
  [GenerationGuidanceAnnotationId]: cvDocumentV1GenerationGuidance,
})

export type CvDocumentV1 = Schema.Schema.Type<typeof CvDocumentV1Schema>
export type CvDocumentV1Encoded = Schema.Codec.Encoded<
  typeof CvDocumentV1Schema
>

export const CvDocumentSchema = CvDocumentV1Schema
export type CvDocument = Schema.Schema.Type<typeof CvDocumentSchema>

export const cvDocumentSchemaRegistry = [
  {
    contractId: cvDocumentV1ContractId,
    version: cvDocumentV1Version,
    schema: CvDocumentV1Schema,
    generationGuidance: cvDocumentV1GenerationGuidance,
  },
] as const

export type CvDocumentContractId =
  (typeof cvDocumentSchemaRegistry)[number]['contractId']

export const getCvDocumentContract = (contractId: string) =>
  contractId === cvDocumentV1ContractId
    ? Option.some(cvDocumentSchemaRegistry[0])
    : Option.none()
