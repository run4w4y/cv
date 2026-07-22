import { Option, Schema } from 'effect'
import {
  CvLocaleSchema,
  NonEmptyTextSchema,
  ShortTextSchema,
  StableIdentifierSchema,
  UriSchema,
} from '../internal/primitives'
import { cvDocumentV1ContractId, cvDocumentV1Version } from './ids'

export * from './generation-guidance'
export * from './ids'

const HeadlineSchema = ShortTextSchema.annotate({
  title: 'Headline',
  description: 'A short role-focused professional headline.',
})

const SummarySchema = NonEmptyTextSchema.pipe(
  Schema.check(Schema.isMaxLength(1_200))
).annotate({
  title: 'Professional summary',
  description: 'A compact role-specific professional summary.',
})

const HighlightSchema = NonEmptyTextSchema.pipe(
  Schema.check(Schema.isMaxLength(500))
).annotate({
  title: 'Highlight',
  description: 'A concise, evidence-backed accomplishment or responsibility.',
})

const TechnologySchema = ShortTextSchema.pipe(
  Schema.check(Schema.isMaxLength(80))
).annotate({
  title: 'Technology',
  description: 'A technology, tool, method, or domain skill.',
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
  }),
  href: Schema.optional(
    UriSchema.annotate({
      title: 'Contact link',
      description: 'Absolute URI opened for this contact method.',
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
  }),
  headline: HeadlineSchema,
  location: Schema.optional(
    ShortTextSchema.annotate({
      title: 'Location',
      description: 'Public location or remote-work location statement.',
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
  }),
  role: ShortTextSchema.annotate({
    title: 'Role',
  }),
  period: ShortTextSchema.annotate({
    title: 'Period',
    description: 'Human-readable employment period.',
  }),
  location: Schema.optional(
    ShortTextSchema.annotate({
      title: 'Location',
    })
  ),
  summary: Schema.optional(
    NonEmptyTextSchema.pipe(Schema.check(Schema.isMaxLength(800))).annotate({
      title: 'Experience summary',
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
  }),
  summary: NonEmptyTextSchema.pipe(
    Schema.check(Schema.isMaxLength(800))
  ).annotate({
    title: 'Project summary',
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
  }),
  qualification: ShortTextSchema.annotate({
    title: 'Qualification',
  }),
  period: ShortTextSchema.annotate({
    title: 'Period',
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
  }),
  direction: Schema.Literal('ltr').annotate({
    title: 'Text direction',
    description: 'Text direction used by the renderer.',
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
  },
] as const

export type CvDocumentContractId =
  (typeof cvDocumentSchemaRegistry)[number]['contractId']

export const getCvDocumentContract = (contractId: string) =>
  contractId === cvDocumentV1ContractId
    ? Option.some(cvDocumentSchemaRegistry[0])
    : Option.none()
