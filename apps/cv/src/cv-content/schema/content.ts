import {
  type Locale,
  localeSchema,
  type ProfileSlug,
  profileSlugSchema,
  type RedactableText,
  type RedactedSectionDescriptor,
  redactableTextSchema,
  redactedSectionDescriptorSchema,
  type VariableLookupDescriptor,
  type VariableUseDescriptor,
} from '@cv/content-core'
import { Schema } from 'effect'

export type {
  Locale,
  ProfileSlug,
  RedactableText,
  RedactedSectionDescriptor,
  VariableLookupDescriptor,
  VariableUseDescriptor,
}

export const stringArraySchema = Schema.Array(Schema.String)

export const arraySchema = <Item extends Schema.Schema<unknown>>(item: Item) =>
  Schema.Array(item)

type SchemaFields = Record<string, Schema.Constraint>

type OptionalSchemaFields<Fields extends SchemaFields> = {
  readonly [Name in keyof Fields]: Schema.optional<Fields[Name]>
}

export const optionalFields = <Fields extends SchemaFields>(
  fields: Fields
): OptionalSchemaFields<Fields> =>
  Object.fromEntries(
    Object.entries(fields).map(([name, schema]) => [
      name,
      Schema.optional(schema),
    ])
  ) as OptionalSchemaFields<Fields>

const textLinkFields = {
  href: Schema.String,
  icon: Schema.optional(Schema.String),
  label: Schema.String,
  value: redactableTextSchema,
}

export const textLinkSchema = Schema.Struct(textLinkFields)
export type TextLink = Schema.Schema.Type<typeof textLinkSchema>

const actionLinkFields = {
  href: Schema.String,
  icon: Schema.optional(Schema.String),
  label: Schema.String,
}

export const actionLinkSchema = Schema.Struct(actionLinkFields)
export type ActionLink = Schema.Schema.Type<typeof actionLinkSchema>

export const documentActionsSchema = Schema.Struct({
  exportPdf: Schema.String,
  scroll: Schema.String,
})

export const documentFooterSchema = Schema.Struct({
  copyright: Schema.String,
  stack: Schema.String,
})

export const documentLinksSchema = Schema.Struct({
  githubProfile: textLinkSchema,
  sourceCode: textLinkSchema,
})

export const documentMetaSchema = Schema.Struct({
  description: Schema.String,
  title: Schema.String,
})

export const cvDocumentSchema = Schema.Struct({
  actions: documentActionsSchema,
  dir: Schema.Literals(['ltr', 'rtl']),
  footer: documentFooterSchema,
  labels: Schema.Record(Schema.String, Schema.String),
  links: documentLinksSchema,
  meta: documentMetaSchema,
  nav: stringArraySchema,
})
export type CvDocument = Schema.Schema.Type<typeof cvDocumentSchema>
export type NavSection = CvDocument['nav'][number]

export const identityFields = {
  handle: Schema.String,
  headline: Schema.String,
  initials: Schema.String,
  lastUpdated: Schema.String,
  location: Schema.String,
  name: redactableTextSchema,
  role: Schema.String,
  summary: Schema.String,
  timezone: Schema.String,
}

export const cvIdentitySchema = Schema.Struct(identityFields)
export type CvIdentity = Schema.Schema.Type<typeof cvIdentitySchema>

export const contactFields = {
  contact: arraySchema(textLinkSchema),
  labels: Schema.Record(Schema.String, Schema.String),
  social: arraySchema(textLinkSchema),
}

export const cvContactSchema = Schema.Struct(contactFields)
export type CvContact = Schema.Schema.Type<typeof cvContactSchema>

const profileMetaFields = {
  headline: Schema.String,
  label: Schema.String,
  lastUpdated: Schema.String,
  locale: localeSchema,
  slug: profileSlugSchema,
  summary: Schema.String,
  targetRole: Schema.String,
}

export const cvProfileMetaSchema = Schema.Struct(profileMetaFields)
export type CvProfileMeta = Schema.Schema.Type<typeof cvProfileMetaSchema>

const provenanceFields = {
  notes: stringArraySchema,
  source: Schema.String,
}

export const cvContentProvenanceSchema = Schema.Struct(provenanceFields)
export type CvContentProvenance = Schema.Schema.Type<
  typeof cvContentProvenanceSchema
>

export const cvSectionListSchema = <Item extends Schema.Schema<unknown>>(
  item: Item
) =>
  Schema.Struct({
    description: Schema.optional(Schema.String),
    items: arraySchema(item),
    label: Schema.String,
  })

export type CvSectionList<Item> = {
  readonly description?: string
  readonly items: readonly Item[]
  readonly label: string
}

const workstreamItemFields = {
  summary: Schema.String,
  title: Schema.String,
}

export const workstreamItemSchema = Schema.Struct(workstreamItemFields)
export type WorkstreamItem = Schema.Schema.Type<typeof workstreamItemSchema>

export const experienceEntryMetaFields = {
  company: redactableTextSchema,
  location: Schema.String,
  period: Schema.String,
  stack: stringArraySchema,
  title: Schema.String,
}

export const experienceEntryMetaSchema = Schema.Struct(
  experienceEntryMetaFields
)
export type ExperienceEntryMeta = Schema.Schema.Type<
  typeof experienceEntryMetaSchema
>

const experienceEntryBodyFields = {
  highlights: stringArraySchema,
  summary: Schema.String,
  workstreams: Schema.optional(arraySchema(workstreamItemSchema)),
}

export const experienceEntryBodySchema = Schema.Struct(
  experienceEntryBodyFields
)
export type ExperienceEntryBody = Schema.Schema.Type<
  typeof experienceEntryBodySchema
>

export const experienceItemSchema = Schema.Struct({
  ...experienceEntryMetaFields,
  ...experienceEntryBodyFields,
  id: Schema.optional(Schema.String),
})
export type ExperienceItem = Schema.Schema.Type<typeof experienceItemSchema>

export const projectEntryMetaFields = {
  name: Schema.String,
  stack: stringArraySchema,
  visibility: Schema.optional(Schema.String),
}

export const projectEntryMetaSchema = Schema.Struct(projectEntryMetaFields)
export type ProjectEntryMeta = Schema.Schema.Type<typeof projectEntryMetaSchema>

const projectEntryBodyFields = {
  links: arraySchema(actionLinkSchema),
  summary: Schema.String,
}

export const projectEntryBodySchema = Schema.Struct(projectEntryBodyFields)
export type ProjectEntryBody = Schema.Schema.Type<typeof projectEntryBodySchema>

export const projectItemSchema = Schema.Struct({
  ...projectEntryMetaFields,
  ...projectEntryBodyFields,
  id: Schema.optional(Schema.String),
})
export type ProjectItem = Schema.Schema.Type<typeof projectItemSchema>

const skillSubgroupFields = {
  group: Schema.String,
  items: stringArraySchema,
}

export const skillSubgroupSchema = Schema.Struct(skillSubgroupFields)
export type SkillSubgroup = Schema.Schema.Type<typeof skillSubgroupSchema>

export const skillGroupFields = {
  group: Schema.String,
  items: Schema.optional(stringArraySchema),
  subgroups: Schema.optional(arraySchema(skillSubgroupSchema)),
}

export const skillGroupSchema = Schema.Struct(skillGroupFields)
export type SkillGroup = Schema.Schema.Type<typeof skillGroupSchema>

const educationThesisFields = {
  links: arraySchema(actionLinkSchema),
  summary: Schema.String,
  title: Schema.String,
}

export const educationThesisSchema = Schema.Struct(educationThesisFields)
export type EducationThesis = Schema.Schema.Type<typeof educationThesisSchema>

export const educationEntryMetaFields = {
  degree: Schema.String,
  details: Schema.String,
  institution: Schema.String,
  location: Schema.String,
  period: Schema.String,
}

export const educationEntryMetaSchema = Schema.Struct(educationEntryMetaFields)
export type EducationEntryMeta = Schema.Schema.Type<
  typeof educationEntryMetaSchema
>

const educationEntryBodyFields = {
  thesis: Schema.optional(educationThesisSchema),
}

export const educationEntryBodySchema = Schema.Struct(educationEntryBodyFields)
export type EducationEntryBody = Schema.Schema.Type<
  typeof educationEntryBodySchema
>

export const educationItemSchema = Schema.Struct({
  ...educationEntryMetaFields,
  ...educationEntryBodyFields,
})
export type EducationItem = Schema.Schema.Type<typeof educationItemSchema>

export const profileHeadingBlockSchema = Schema.Struct({
  text: Schema.String,
  type: Schema.Literal('heading'),
})
export type ProfileHeadingBlock = Schema.Schema.Type<
  typeof profileHeadingBlockSchema
>

export const profileTitleBlockSchema = Schema.Struct({
  text: Schema.String,
  type: Schema.Literal('title'),
})
export type ProfileTitleBlock = Schema.Schema.Type<
  typeof profileTitleBlockSchema
>

export const profileTextBlockSchema = Schema.Struct({
  text: Schema.String,
  type: Schema.Literal('text'),
})
export type ProfileTextBlock = Schema.Schema.Type<typeof profileTextBlockSchema>

export const profileDetailBlockSchema = Schema.Struct({
  href: Schema.optional(Schema.String),
  label: Schema.String,
  note: Schema.optional(Schema.String),
  type: Schema.Literal('detail'),
  value: redactableTextSchema,
})
export type ProfileDetailBlock = Schema.Schema.Type<
  typeof profileDetailBlockSchema
>

export const profileRedactedBlockSchema = Schema.Struct({
  descriptor: redactedSectionDescriptorSchema,
  items: arraySchema(profileDetailBlockSchema),
  type: Schema.Literal('redacted'),
})
export type ProfileRedactedBlock = Schema.Schema.Type<
  typeof profileRedactedBlockSchema
>

export const profileBlockSchema = Schema.Union([
  profileHeadingBlockSchema,
  profileTitleBlockSchema,
  profileTextBlockSchema,
  profileDetailBlockSchema,
  profileRedactedBlockSchema,
])
export type ProfileBlock = Schema.Schema.Type<typeof profileBlockSchema>

export const profileSectionSchema = Schema.Struct({
  blocks: arraySchema(profileBlockSchema),
  id: Schema.String,
})
export type ProfileSection = Schema.Schema.Type<typeof profileSectionSchema>

export const cvAboutSectionSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  id: Schema.Literal('about'),
  index: Schema.String,
  items: arraySchema(profileSectionSchema),
  label: Schema.String,
  type: Schema.Literal('profile'),
})
export type CvAboutSection = Schema.Schema.Type<typeof cvAboutSectionSchema>

export const cvExperienceSectionSchema = Schema.Struct({
  ...cvSectionListSchema(experienceItemSchema).fields,
  id: Schema.Literal('experience'),
  index: Schema.String,
  type: Schema.Literal('experience'),
})
export type CvExperienceSection = Schema.Schema.Type<
  typeof cvExperienceSectionSchema
>

export const cvProjectsSectionSchema = Schema.Struct({
  ...cvSectionListSchema(projectItemSchema).fields,
  id: Schema.Literal('projects'),
  index: Schema.String,
  type: Schema.Literal('projects'),
})
export type CvProjectsSection = Schema.Schema.Type<
  typeof cvProjectsSectionSchema
>

export const skillsContentFields = {
  ...cvSectionListSchema(skillGroupSchema).fields,
  printStack: stringArraySchema,
}

export const skillsContentSchema = Schema.Struct(skillsContentFields)
export type SkillsContent = Schema.Schema.Type<typeof skillsContentSchema>

export const cvSkillsSectionSchema = Schema.Struct({
  ...skillsContentSchema.fields,
  id: Schema.Literal('skills'),
  index: Schema.String,
  type: Schema.Literal('skills'),
})
export type CvSkillsSection = Schema.Schema.Type<typeof cvSkillsSectionSchema>

export const cvEducationSectionSchema = Schema.Struct({
  ...cvSectionListSchema(educationItemSchema).fields,
  id: Schema.Literal('education'),
  index: Schema.String,
  type: Schema.Literal('education'),
})
export type CvEducationSection = Schema.Schema.Type<
  typeof cvEducationSectionSchema
>

export const cvSectionSchema = Schema.Union([
  cvAboutSectionSchema,
  cvEducationSectionSchema,
  cvExperienceSectionSchema,
  cvProjectsSectionSchema,
  cvSkillsSectionSchema,
])
export type CvSection = Schema.Schema.Type<typeof cvSectionSchema>

export const cvContentSchema = Schema.Struct({
  contact: cvContactSchema,
  document: cvDocumentSchema,
  identity: cvIdentitySchema,
  profile: cvProfileMetaSchema,
  provenance: cvContentProvenanceSchema,
  sections: arraySchema(cvSectionSchema),
})
export type CvContent = Schema.Schema.Type<typeof cvContentSchema>
