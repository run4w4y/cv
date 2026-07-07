import { Schema } from 'effect'
import {
  contactFields,
  cvContactSchema,
  cvDocumentSchema,
  cvIdentitySchema,
  documentActionsSchema,
  documentFooterSchema,
  documentLinksSchema,
  documentMetaSchema,
  educationEntryMetaFields,
  educationEntryMetaSchema,
  educationItemSchema,
  experienceEntryMetaFields,
  experienceEntryMetaSchema,
  experienceItemSchema,
  identityFields,
  optionalFields,
  profileSectionSchema,
  projectEntryMetaFields,
  projectEntryMetaSchema,
  projectItemSchema,
  skillsContentFields,
  skillsContentSchema,
  stringArraySchema,
} from './content'

const rawDocumentSchema = Schema.Struct({
  actions: Schema.optional(
    Schema.Struct(optionalFields(documentActionsSchema.fields))
  ),
  dir: Schema.optional(Schema.Literals(['ltr', 'rtl'])),
  footer: Schema.optional(
    Schema.Struct(optionalFields(documentFooterSchema.fields))
  ),
  labels: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  links: Schema.optional(
    Schema.Struct(optionalFields(documentLinksSchema.fields))
  ),
  meta: Schema.optional(
    Schema.Struct(optionalFields(documentMetaSchema.fields))
  ),
  nav: Schema.optional(stringArraySchema),
})

const rawContactSchema = Schema.Struct(optionalFields(contactFields))

const rawIdentitySchema = Schema.Struct(optionalFields(identityFields))

export const rawAboutSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  label: Schema.optional(Schema.String),
})
export type RawAbout = Schema.Schema.Type<typeof rawAboutSchema>

export const rawSectionSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  label: Schema.optional(Schema.String),
})
export type RawSection = Schema.Schema.Type<typeof rawSectionSchema> | undefined

export const rawSkillsSchema = Schema.Struct(
  optionalFields(skillsContentFields)
)
export type RawSkills = Schema.Schema.Type<typeof rawSkillsSchema>

export const rawProfileMetaSchema = Schema.Struct({
  headline: Schema.optional(Schema.String),
  label: Schema.optional(Schema.String),
  lastUpdated: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  targetRole: Schema.optional(Schema.String),
})
export type RawProfileMeta = Schema.Schema.Type<typeof rawProfileMetaSchema>

const rawProvenanceSchema = Schema.Struct({
  notes: Schema.optional(stringArraySchema),
  source: Schema.optional(Schema.String),
})

export const rawProfileDocumentSchema = Schema.Struct({
  about: Schema.optional(rawAboutSchema),
  contact: Schema.optional(rawContactSchema),
  document: Schema.optional(rawDocumentSchema),
  education: Schema.optional(rawSectionSchema),
  experience: Schema.optional(rawSectionSchema),
  identity: Schema.optional(rawIdentitySchema),
  profile: Schema.optional(rawProfileMetaSchema),
  projects: Schema.optional(rawSectionSchema),
  provenance: Schema.optional(rawProvenanceSchema),
  skills: Schema.optional(rawSkillsSchema),
})
export type RawProfileDocument = Schema.Schema.Type<
  typeof rawProfileDocumentSchema
>

export const localeBaseContentSchema = Schema.Struct({
  contact: cvContactSchema,
  document: cvDocumentSchema,
  education: rawSectionSchema,
  identity: cvIdentitySchema,
})
export type LocaleBaseContent = Schema.Schema.Type<
  typeof localeBaseContentSchema
>

export const contentModuleSchemas = {
  contact: cvContactSchema,
  document: cvDocumentSchema,
  education: rawSectionSchema,
  identity: cvIdentitySchema,
  profile: rawProfileDocumentSchema,
  skills: skillsContentSchema,
} as const

export type ContentModules = {
  readonly [Name in keyof typeof contentModuleSchemas]: Schema.Schema.Type<
    (typeof contentModuleSchemas)[Name]
  >
}

export const contentEntrySchemas = {
  education: educationItemSchema,
  experience: experienceItemSchema,
  profile: profileSectionSchema,
  projects: projectItemSchema,
} as const

export type ContentEntries = {
  readonly [Name in keyof typeof contentEntrySchemas]: Schema.Schema.Type<
    (typeof contentEntrySchemas)[Name]
  >
}

export const contentMdxMetaSchemas = {
  education: educationEntryMetaSchema,
  experience: experienceEntryMetaSchema,
  projects: projectEntryMetaSchema,
} as const

export type ContentMdxMeta = {
  readonly [Name in keyof typeof contentMdxMetaSchemas]: Schema.Schema.Type<
    (typeof contentMdxMetaSchemas)[Name]
  >
}

export const contentMdxSourceMetaSchemas = {
  education: Schema.Struct(optionalFields(educationEntryMetaFields)),
  experience: Schema.Struct(optionalFields(experienceEntryMetaFields)),
  projects: Schema.Struct(optionalFields(projectEntryMetaFields)),
} as const
