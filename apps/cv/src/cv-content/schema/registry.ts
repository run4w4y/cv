import {
  localeSchema,
  profileSlugSchema,
  redactableTextSchema,
  redactedSectionDescriptorSchema,
  variableLookupDescriptorSchema,
  variableUseDescriptorSchema,
} from '@cv/content-core'
import { Schema } from 'effect'
import {
  actionLinkSchema,
  cvAboutSectionSchema,
  cvContactSchema,
  cvContentProvenanceSchema,
  cvContentSchema,
  cvDocumentSchema,
  cvEducationSectionSchema,
  cvExperienceSectionSchema,
  cvIdentitySchema,
  cvProfileMetaSchema,
  cvProjectsSectionSchema,
  cvSectionSchema,
  cvSkillsSectionSchema,
  educationEntryBodySchema,
  educationEntryMetaSchema,
  educationItemSchema,
  educationThesisSchema,
  experienceEntryBodySchema,
  experienceEntryMetaSchema,
  experienceItemSchema,
  profileBlockSchema,
  profileDetailBlockSchema,
  profileHeadingBlockSchema,
  profileRedactedBlockSchema,
  profileSectionSchema,
  profileTextBlockSchema,
  profileTitleBlockSchema,
  projectEntryBodySchema,
  projectEntryMetaSchema,
  projectItemSchema,
  skillGroupSchema,
  skillSubgroupSchema,
  skillsContentSchema,
  textLinkSchema,
  workstreamItemSchema,
} from './content'
import {
  contentEntrySchemas,
  contentMdxMetaSchemas,
  contentModuleSchemas,
  localeBaseContentSchema,
  rawAboutSchema,
  rawProfileDocumentSchema,
  rawProfileMetaSchema,
  rawSkillsSchema,
} from './source'

export { cvContentSchema } from './content'
export {
  contentEntrySchemas,
  contentMdxSourceMetaSchemas,
  contentModuleSchemas,
} from './source'

export const cvContentSchemaVersion = 'cv.content.v1'

export const contentSchemas = {
  ambient: {
    Locale: localeSchema,
    ProfileSlug: profileSlugSchema,
    RedactableText: redactableTextSchema,
    RedactedSectionDescriptor: redactedSectionDescriptorSchema,
    VariableLookupDescriptor: variableLookupDescriptorSchema,
    VariableUseDescriptor: variableUseDescriptorSchema,
  },
  declarations: {
    TextLink: textLinkSchema,
    ActionLink: actionLinkSchema,
    CvDocument: cvDocumentSchema,
    CvIdentity: cvIdentitySchema,
    CvContact: cvContactSchema,
    CvProfileMeta: cvProfileMetaSchema,
    CvContentProvenance: cvContentProvenanceSchema,
    CvSectionList: undefined,
    WorkstreamItem: workstreamItemSchema,
    ExperienceEntryMeta: experienceEntryMetaSchema,
    ExperienceEntryBody: experienceEntryBodySchema,
    ExperienceItem: experienceItemSchema,
    ProjectEntryMeta: projectEntryMetaSchema,
    ProjectEntryBody: projectEntryBodySchema,
    ProjectItem: projectItemSchema,
    SkillSubgroup: skillSubgroupSchema,
    SkillGroup: skillGroupSchema,
    EducationThesis: educationThesisSchema,
    EducationEntryMeta: educationEntryMetaSchema,
    EducationEntryBody: educationEntryBodySchema,
    EducationItem: educationItemSchema,
    ProfileHeadingBlock: profileHeadingBlockSchema,
    ProfileTitleBlock: profileTitleBlockSchema,
    ProfileTextBlock: profileTextBlockSchema,
    ProfileDetailBlock: profileDetailBlockSchema,
    ProfileRedactedBlock: profileRedactedBlockSchema,
    ProfileBlock: profileBlockSchema,
    ProfileSection: profileSectionSchema,
    CvAboutSection: cvAboutSectionSchema,
    CvExperienceSection: cvExperienceSectionSchema,
    CvProjectsSection: cvProjectsSectionSchema,
    SkillsContent: skillsContentSchema,
    CvSkillsSection: cvSkillsSectionSchema,
    CvEducationSection: cvEducationSectionSchema,
    CvSection: cvSectionSchema,
    CvContent: cvContentSchema,
    RawAbout: rawAboutSchema,
    RawSkills: rawSkillsSchema,
    RawProfileMeta: rawProfileMetaSchema,
    RawProfileDocument: rawProfileDocumentSchema,
    LocaleBaseContent: localeBaseContentSchema,
  },
  entries: contentEntrySchemas,
  mdxMeta: contentMdxMetaSchemas,
  modules: contentModuleSchemas,
} as const

export const decodeCvContentSchema = <Value>(
  schema: Schema.ConstraintDecoder<Value>,
  value: unknown,
  context: string
): Value => {
  const decode = Schema.decodeUnknownSync(schema, { errors: 'all' })

  try {
    return decode(value)
  } catch (cause) {
    throw new Error(`Invalid CV content at ${context}: ${String(cause)}`, {
      cause,
    })
  }
}
