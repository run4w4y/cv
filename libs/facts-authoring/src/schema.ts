import {
  ContactFactsSectionV1Schema,
  ContactItemV1Schema,
  EducationEntryV1Schema,
  EducationFactsSectionV1Schema,
  EducationThesisV1Schema,
  ExperienceEntryV1Schema,
  ExperienceFactsSectionV1Schema,
  ExperienceWorkstreamV1Schema,
  FactLinkV1Schema,
  FactTailoringGuidanceV1Schema,
  IdentityFactsSectionV1Schema,
  IdentityLanguageV1Schema,
  ProjectContributionV1Schema,
  ProjectEntryV1Schema,
  ProjectsFactsSectionV1Schema,
  ReviewedFactV1Schema,
  SkillEntryV1Schema,
  SkillGroupV1Schema,
  SkillsFactsSectionV1Schema,
} from '@cv/contracts/facts'
import { Schema } from 'effect'

const IdentifierSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(160),
    Schema.isPattern(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u)
  )
)

const LocaleSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(2),
    Schema.isMaxLength(32),
    Schema.isPattern(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u)
  )
)

const TextSchema = Schema.String.pipe(
  Schema.check(
    Schema.isTrimmed(),
    Schema.isMinLength(1),
    Schema.isMaxLength(4_000)
  )
)

const ShortTextSchema = TextSchema.pipe(Schema.check(Schema.isMaxLength(240)))

const RelativePathSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(512),
    Schema.isPattern(/^(?![\\/])(?!.*(?:^|[\\/])\.\.?([\\/]|$))[^\\]+$/u)
  )
)

const FactListSchema = <S extends Schema.Top>(schema: S, maxLength: number) =>
  Schema.Array(schema).pipe(Schema.check(Schema.isMaxLength(maxLength)))

export const FactsRepositoryConfigSourceSchema = Schema.Struct({
  factsDir: RelativePathSchema,
  defaultLocale: LocaleSchema,
  locales: Schema.Array(LocaleSchema).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  identifier: 'FactsRepositoryConfigSource',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
})

export interface FactsRepositoryConfigSource
  extends Schema.Schema.Type<typeof FactsRepositoryConfigSourceSchema> {}

export const FactEvidenceSourceSchema = Schema.Struct({
  kind: Schema.Literals([
    'primary-source',
    'public-source',
    'private-source',
    'personal-review',
  ]),
  title: ShortTextSchema,
  uri: Schema.optionalKey(
    TextSchema.pipe(Schema.check(Schema.isMaxLength(2_048)))
  ),
  note: Schema.optionalKey(
    TextSchema.pipe(Schema.check(Schema.isMaxLength(1_000)))
  ),
}).annotate({ identifier: 'FactEvidenceSource' })

export interface FactEvidenceSource
  extends Schema.Schema.Type<typeof FactEvidenceSourceSchema> {}

export const FactEvidenceRegistrySourceSchema = Schema.Record(
  IdentifierSchema,
  FactEvidenceSourceSchema
).annotate({ identifier: 'FactEvidenceRegistrySource' })

export interface FactEvidenceRegistrySource
  extends Schema.Schema.Type<typeof FactEvidenceRegistrySourceSchema> {}

export const FactAssetSourceSchema = Schema.Struct({
  fileName: RelativePathSchema,
  label: ShortTextSchema,
  description: TextSchema.pipe(Schema.check(Schema.isMaxLength(1_000))),
  mediaType: ShortTextSchema,
}).annotate({ identifier: 'FactAssetSource' })

export interface FactAssetSource
  extends Schema.Schema.Type<typeof FactAssetSourceSchema> {}

export const FactAssetRegistrySourceSchema = Schema.Record(
  IdentifierSchema,
  FactAssetSourceSchema
).annotate({ identifier: 'FactAssetRegistrySource' })

export interface FactAssetRegistrySource
  extends Schema.Schema.Type<typeof FactAssetRegistrySourceSchema> {}

export const FactTailoringGuidanceSourceSchema = FactTailoringGuidanceV1Schema
export type FactTailoringGuidanceSource = Schema.Schema.Type<
  typeof FactTailoringGuidanceSourceSchema
>

export const ReviewedFactSourceSchema = Schema.Struct({
  text: ReviewedFactV1Schema.fields.text,
  evidenceIds: ReviewedFactV1Schema.fields.evidenceIds,
  assetIds: ReviewedFactV1Schema.fields.assetIds,
  guidance: ReviewedFactV1Schema.fields.guidance,
}).annotate({ identifier: 'ReviewedFactSource' })

export interface ReviewedFactSource
  extends Schema.Schema.Type<typeof ReviewedFactSourceSchema> {}

export const FactLinkSourceSchema = Schema.Struct({
  label: FactLinkV1Schema.fields.label,
  url: FactLinkV1Schema.fields.url,
  visibility: FactLinkV1Schema.fields.visibility,
}).annotate({ identifier: 'FactLinkSource' })

export interface FactLinkSource
  extends Schema.Schema.Type<typeof FactLinkSourceSchema> {}

export const IdentityLanguageSourceSchema = Schema.Struct({
  name: IdentityLanguageV1Schema.fields.name,
  proficiency: IdentityLanguageV1Schema.fields.proficiency,
}).annotate({ identifier: 'IdentityLanguageSource' })

export interface IdentityLanguageSource
  extends Schema.Schema.Type<typeof IdentityLanguageSourceSchema> {}

export const IdentitySectionSourceSchema = Schema.Struct({
  kind: IdentityFactsSectionV1Schema.fields.kind,
  guidance: IdentityFactsSectionV1Schema.fields.guidance,
  name: IdentityFactsSectionV1Schema.fields.name,
  handle: IdentityFactsSectionV1Schema.fields.handle,
  location: IdentityFactsSectionV1Schema.fields.location,
  timezone: IdentityFactsSectionV1Schema.fields.timezone,
  headline: IdentityFactsSectionV1Schema.fields.headline,
  overview: Schema.optionalKey(ReviewedFactSourceSchema),
  facts: FactListSchema(ReviewedFactSourceSchema, 128),
  languages: FactListSchema(IdentityLanguageSourceSchema, 32),
}).annotate({ identifier: 'IdentitySectionSource' })

export interface IdentitySectionSource
  extends Schema.Schema.Type<typeof IdentitySectionSourceSchema> {}

export const ContactItemSourceSchema = Schema.Struct({
  kind: ContactItemV1Schema.fields.kind,
  label: ContactItemV1Schema.fields.label,
  value: ContactItemV1Schema.fields.value,
  url: ContactItemV1Schema.fields.url,
  visibility: ContactItemV1Schema.fields.visibility,
}).annotate({ identifier: 'ContactItemSource' })

export interface ContactItemSource
  extends Schema.Schema.Type<typeof ContactItemSourceSchema> {}

export const ContactSectionSourceSchema = Schema.Struct({
  kind: ContactFactsSectionV1Schema.fields.kind,
  guidance: ContactFactsSectionV1Schema.fields.guidance,
  items: FactListSchema(ContactItemSourceSchema, 32),
}).annotate({ identifier: 'ContactSectionSource' })

export interface ContactSectionSource
  extends Schema.Schema.Type<typeof ContactSectionSourceSchema> {}

export const EducationThesisSourceSchema = Schema.Struct({
  title: EducationThesisV1Schema.fields.title,
  summary: ReviewedFactSourceSchema,
  links: FactListSchema(FactLinkSourceSchema, 16),
  assetIds: EducationThesisV1Schema.fields.assetIds,
}).annotate({ identifier: 'EducationThesisSource' })

export interface EducationThesisSource
  extends Schema.Schema.Type<typeof EducationThesisSourceSchema> {}

export const EducationEntrySourceSchema = Schema.Struct({
  institution: EducationEntryV1Schema.fields.institution,
  degree: EducationEntryV1Schema.fields.degree,
  location: EducationEntryV1Schema.fields.location,
  period: EducationEntryV1Schema.fields.period,
  details: FactListSchema(ReviewedFactSourceSchema, 64),
  thesis: Schema.optionalKey(EducationThesisSourceSchema),
  guidance: EducationEntryV1Schema.fields.guidance,
}).annotate({ identifier: 'EducationEntrySource' })

export interface EducationEntrySource
  extends Schema.Schema.Type<typeof EducationEntrySourceSchema> {}

export const EducationSectionSourceSchema = Schema.Struct({
  kind: EducationFactsSectionV1Schema.fields.kind,
  guidance: EducationFactsSectionV1Schema.fields.guidance,
  entries: FactListSchema(EducationEntrySourceSchema, 32),
}).annotate({ identifier: 'EducationSectionSource' })

export interface EducationSectionSource
  extends Schema.Schema.Type<typeof EducationSectionSourceSchema> {}

export const ExperienceWorkstreamSourceSchema = Schema.Struct({
  title: ExperienceWorkstreamV1Schema.fields.title,
  overview: Schema.optionalKey(ReviewedFactSourceSchema),
  contributions: FactListSchema(ReviewedFactSourceSchema, 128),
  technologies: Schema.optionalKey(
    ExperienceWorkstreamV1Schema.fields.technologies
  ),
  guidance: ExperienceWorkstreamV1Schema.fields.guidance,
}).annotate({ identifier: 'ExperienceWorkstreamSource' })

export interface ExperienceWorkstreamSource
  extends Schema.Schema.Type<typeof ExperienceWorkstreamSourceSchema> {}

export const ExperienceEntrySourceSchema = Schema.Struct({
  company: ExperienceEntryV1Schema.fields.company,
  companyVisibility: ExperienceEntryV1Schema.fields.companyVisibility,
  location: ExperienceEntryV1Schema.fields.location,
  period: ExperienceEntryV1Schema.fields.period,
  roles: ExperienceEntryV1Schema.fields.roles,
  overview: Schema.optionalKey(ReviewedFactSourceSchema),
  highlights: FactListSchema(ReviewedFactSourceSchema, 256),
  workstreams: FactListSchema(ExperienceWorkstreamSourceSchema, 128),
  technologies: Schema.optionalKey(ExperienceEntryV1Schema.fields.technologies),
  guidance: ExperienceEntryV1Schema.fields.guidance,
}).annotate({ identifier: 'ExperienceEntrySource' })

export interface ExperienceEntrySource
  extends Schema.Schema.Type<typeof ExperienceEntrySourceSchema> {}

export const ExperienceSectionSourceSchema = Schema.Struct({
  kind: ExperienceFactsSectionV1Schema.fields.kind,
  guidance: ExperienceFactsSectionV1Schema.fields.guidance,
  entries: FactListSchema(ExperienceEntrySourceSchema, 64),
}).annotate({ identifier: 'ExperienceSectionSource' })

export interface ExperienceSectionSource
  extends Schema.Schema.Type<typeof ExperienceSectionSourceSchema> {}

export const ProjectContributionSourceSchema = Schema.Struct({
  title: ProjectContributionV1Schema.fields.title,
  area: ProjectContributionV1Schema.fields.area,
  facts: FactListSchema(ReviewedFactSourceSchema, 128),
  technologies: Schema.optionalKey(
    ProjectContributionV1Schema.fields.technologies
  ),
  guidance: ProjectContributionV1Schema.fields.guidance,
}).annotate({ identifier: 'ProjectContributionSource' })

export interface ProjectContributionSource
  extends Schema.Schema.Type<typeof ProjectContributionSourceSchema> {}

export const ProjectEntrySourceSchema = Schema.Struct({
  name: ProjectEntryV1Schema.fields.name,
  visibility: ProjectEntryV1Schema.fields.visibility,
  summary: ReviewedFactSourceSchema,
  links: FactListSchema(FactLinkSourceSchema, 16),
  contributions: FactListSchema(ProjectContributionSourceSchema, 128),
  technologies: Schema.optionalKey(ProjectEntryV1Schema.fields.technologies),
  guidance: ProjectEntryV1Schema.fields.guidance,
}).annotate({ identifier: 'ProjectEntrySource' })

export interface ProjectEntrySource
  extends Schema.Schema.Type<typeof ProjectEntrySourceSchema> {}

export const ProjectsSectionSourceSchema = Schema.Struct({
  kind: ProjectsFactsSectionV1Schema.fields.kind,
  guidance: ProjectsFactsSectionV1Schema.fields.guidance,
  entries: FactListSchema(ProjectEntrySourceSchema, 128),
}).annotate({ identifier: 'ProjectsSectionSource' })

export interface ProjectsSectionSource
  extends Schema.Schema.Type<typeof ProjectsSectionSourceSchema> {}

export const SkillEntrySourceSchema = Schema.Struct({
  name: SkillEntryV1Schema.fields.name,
  details: Schema.optionalKey(ReviewedFactSourceSchema),
}).annotate({ identifier: 'SkillEntrySource' })

export interface SkillEntrySource
  extends Schema.Schema.Type<typeof SkillEntrySourceSchema> {}

export const SkillGroupSourceSchema = Schema.Struct({
  title: SkillGroupV1Schema.fields.title,
  skills: FactListSchema(SkillEntrySourceSchema, 256),
  guidance: SkillGroupV1Schema.fields.guidance,
}).annotate({ identifier: 'SkillGroupSource' })

export interface SkillGroupSource
  extends Schema.Schema.Type<typeof SkillGroupSourceSchema> {}

export const SkillsSectionSourceSchema = Schema.Struct({
  kind: SkillsFactsSectionV1Schema.fields.kind,
  guidance: SkillsFactsSectionV1Schema.fields.guidance,
  groups: FactListSchema(SkillGroupSourceSchema, 64),
}).annotate({ identifier: 'SkillsSectionSource' })

export interface SkillsSectionSource
  extends Schema.Schema.Type<typeof SkillsSectionSourceSchema> {}

export const FactSectionSourceSchema = Schema.Union([
  IdentitySectionSourceSchema,
  ContactSectionSourceSchema,
  EducationSectionSourceSchema,
  ExperienceSectionSourceSchema,
  ProjectsSectionSourceSchema,
  SkillsSectionSourceSchema,
]).annotate({
  identifier: 'FactSectionSource',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
})

export type FactSectionSource = Schema.Schema.Type<
  typeof FactSectionSourceSchema
>
