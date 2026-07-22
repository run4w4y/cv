import { Schema } from 'effect'

import { NonEmptyTextSchema, ShortTextSchema } from '../internal/primitives'
import { cvDocumentV1ContractId, cvGenerationGuidanceV1ContractId } from './ids'

const GuidanceTextSchema = NonEmptyTextSchema.pipe(
  Schema.check(Schema.isMaxLength(4_000))
)

export const cvGenerationGuidanceSourceValues = [
  'trusted-facts',
  'job-context',
  'literal',
] as const

export const CvGenerationGuidanceSourceSchema = Schema.Literals(
  cvGenerationGuidanceSourceValues
)
export type CvGenerationGuidanceSource = Schema.Schema.Type<
  typeof CvGenerationGuidanceSourceSchema
>

export const cvGenerationGuidanceFieldTargetValues = [
  'document.locale',
  'document.direction',
  'person.name',
  'person.headline',
  'person.location',
  'person.summary',
  'person.contacts.value',
  'person.contacts.href',
  'experience.company',
  'experience.role',
  'experience.period',
  'experience.location',
  'experience.summary',
  'experience.highlights',
  'experience.technologies',
  'projects.name',
  'projects.summary',
  'projects.highlights',
  'projects.technologies',
  'projects.links.value',
  'projects.links.href',
  'skills.label',
  'skills.items',
  'education.institution',
  'education.qualification',
  'education.period',
  'education.details',
  'additionalSections.items.text',
] as const

export const CvGenerationGuidanceFieldTargetSchema = Schema.Literals(
  cvGenerationGuidanceFieldTargetValues
)
export type CvGenerationGuidanceFieldTarget = Schema.Schema.Type<
  typeof CvGenerationGuidanceFieldTargetSchema
>

export type CvGenerationGuidanceTarget = {
  readonly id: CvGenerationGuidanceFieldTarget
  readonly pointer: string
  readonly title: string
}

export const cvGenerationGuidanceTargets = [
  { id: 'document.locale', pointer: '/locale', title: 'Locale' },
  { id: 'document.direction', pointer: '/direction', title: 'Text direction' },
  { id: 'person.name', pointer: '/person/name', title: 'Name' },
  { id: 'person.headline', pointer: '/person/headline', title: 'Headline' },
  { id: 'person.location', pointer: '/person/location', title: 'Location' },
  {
    id: 'person.summary',
    pointer: '/person/summary',
    title: 'Professional summary',
  },
  {
    id: 'person.contacts.value',
    pointer: '/person/contacts/*/value',
    title: 'Contact value',
  },
  {
    id: 'person.contacts.href',
    pointer: '/person/contacts/*/href',
    title: 'Contact link',
  },
  {
    id: 'experience.company',
    pointer: '/experience/*/company',
    title: 'Experience company',
  },
  {
    id: 'experience.role',
    pointer: '/experience/*/role',
    title: 'Experience role',
  },
  {
    id: 'experience.period',
    pointer: '/experience/*/period',
    title: 'Experience period',
  },
  {
    id: 'experience.location',
    pointer: '/experience/*/location',
    title: 'Experience location',
  },
  {
    id: 'experience.summary',
    pointer: '/experience/*/summary',
    title: 'Experience summary',
  },
  {
    id: 'experience.highlights',
    pointer: '/experience/*/highlights/*',
    title: 'Experience highlight',
  },
  {
    id: 'experience.technologies',
    pointer: '/experience/*/technologies/*',
    title: 'Experience technology',
  },
  {
    id: 'projects.name',
    pointer: '/projects/*/name',
    title: 'Project name',
  },
  {
    id: 'projects.summary',
    pointer: '/projects/*/summary',
    title: 'Project summary',
  },
  {
    id: 'projects.highlights',
    pointer: '/projects/*/highlights/*',
    title: 'Project highlight',
  },
  {
    id: 'projects.technologies',
    pointer: '/projects/*/technologies/*',
    title: 'Project technology',
  },
  {
    id: 'projects.links.value',
    pointer: '/projects/*/links/*/value',
    title: 'Project link value',
  },
  {
    id: 'projects.links.href',
    pointer: '/projects/*/links/*/href',
    title: 'Project link URL',
  },
  {
    id: 'skills.label',
    pointer: '/skills/*/label',
    title: 'Skill group label',
  },
  {
    id: 'skills.items',
    pointer: '/skills/*/items/*',
    title: 'Skill item',
  },
  {
    id: 'education.institution',
    pointer: '/education/*/institution',
    title: 'Institution',
  },
  {
    id: 'education.qualification',
    pointer: '/education/*/qualification',
    title: 'Qualification',
  },
  {
    id: 'education.period',
    pointer: '/education/*/period',
    title: 'Education period',
  },
  {
    id: 'education.details',
    pointer: '/education/*/details/*',
    title: 'Education detail',
  },
  {
    id: 'additionalSections.items.text',
    pointer: '/additionalSections/*/items/*/text',
    title: 'Additional item text',
  },
] as const satisfies ReadonlyArray<CvGenerationGuidanceTarget>

const GuidanceSourcesSchema = Schema.UniqueArray(
  CvGenerationGuidanceSourceSchema
).pipe(Schema.check(Schema.isMinLength(1)))

export const CvFieldGenerationGuidanceV1Schema = Schema.Struct({
  target: CvGenerationGuidanceFieldTargetSchema,
  instruction: GuidanceTextSchema,
  sources: GuidanceSourcesSchema,
  maxWords: Schema.optionalKey(
    Schema.Int.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(1)),
      Schema.check(Schema.isLessThanOrEqualTo(1_000))
    )
  ),
}).annotate({ identifier: 'CvFieldGenerationGuidanceV1' })

export interface CvFieldGenerationGuidanceV1
  extends Schema.Schema.Type<typeof CvFieldGenerationGuidanceV1Schema> {}

const fieldCoverageIssues = (
  fields: ReadonlyArray<CvFieldGenerationGuidanceV1>
): ReadonlyArray<Schema.FilterIssue> => {
  const expected = new Set<string>(cvGenerationGuidanceFieldTargetValues)
  const seen = new Set<string>()
  const issues: Array<Schema.FilterIssue> = []

  fields.forEach((field, index) => {
    if (seen.has(field.target)) {
      issues.push({
        path: [index, 'target'],
        issue: `Duplicate CV generation guidance target: ${field.target}`,
      })
    }
    seen.add(field.target)
    expected.delete(field.target)
  })

  for (const target of expected) {
    issues.push({
      path: [],
      issue: `Missing CV generation guidance target: ${target}`,
    })
  }
  return issues
}

const CvGenerationGuidanceV1StructureSchema = Schema.Struct({
  $schema: Schema.Literal(cvGenerationGuidanceV1ContractId),
  documentContract: Schema.Literal(cvDocumentV1ContractId),
  instruction: GuidanceTextSchema,
  sources: GuidanceSourcesSchema,
  rules: Schema.Array(GuidanceTextSchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(32))
  ),
  fields: Schema.Array(CvFieldGenerationGuidanceV1Schema).pipe(
    Schema.check(Schema.makeFilter(fieldCoverageIssues))
  ),
  label: ShortTextSchema,
})

export const CvGenerationGuidanceV1Schema =
  CvGenerationGuidanceV1StructureSchema.annotate({
    identifier: 'CvGenerationGuidanceV1',
    title: 'CV generation guidance v1',
    description:
      'Reviewed writing guidance applied when generating cv.document.v1 content.',
    parseOptions: { errors: 'all', onExcessProperty: 'error' },
  })

export interface CvGenerationGuidanceV1
  extends Schema.Schema.Type<typeof CvGenerationGuidanceV1Schema> {}

export const fieldGenerationGuidance = (
  guidance: CvGenerationGuidanceV1,
  target: CvGenerationGuidanceFieldTarget
): CvFieldGenerationGuidanceV1 => {
  const field = guidance.fields.find((candidate) => candidate.target === target)
  if (field === undefined) {
    throw new Error(`Missing decoded CV generation guidance target: ${target}`)
  }
  return field
}
