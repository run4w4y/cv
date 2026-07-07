import { cloneValue, mergeValue, requireField } from '@cv/content-composer'
import type { Locale, ProfileSlug } from '@cv/content-core'
import type { CvMdxBlocks } from '../authoring/blocks'
import { profileBlocksFromMdx } from '../authoring/profile-blocks'
import type {
  CvAboutSection,
  CvContent,
  CvContentProvenance,
  CvDocument,
  CvProfileMeta,
  CvSection,
  EducationItem,
  ExperienceItem,
  ProfileSection,
  ProjectItem,
  SkillsContent,
} from '../model'
import * as CvSchema from '../schema/registry'
import type {
  RawAbout,
  RawProfileDocument,
  RawProfileMeta,
  RawSkills,
} from '../schema/source'
import {
  type ContentLoadContext,
  decodeSourceValue,
  loadLocaleBase,
  type MaterializedCvContent,
  readProfileModule,
} from './context'
import { loadProfileManifest } from './discovery'
import {
  discoverMdxSectionEntries,
  materializeBaseMdxSection,
  mergeMdxSection,
  type SectionMdxEntry,
} from './mdx-sections'

const profileMeta = (
  meta: RawProfileMeta | CvProfileMeta,
  locale: Locale,
  profile: ProfileSlug
): CvProfileMeta =>
  ({
    ...meta,
    locale,
    slug: profile,
  }) as CvProfileMeta

const applyExperienceMdx = (
  item: Partial<ExperienceItem>,
  blocks: CvMdxBlocks
): Partial<ExperienceItem> => ({
  ...item,
  ...(blocks.summary ? { summary: blocks.summary.text } : {}),
  ...(blocks.highlights ? { highlights: blocks.highlights } : {}),
  ...(blocks.workstreams
    ? {
        workstreams: blocks.workstreams.map(({ summary, title }) => ({
          summary,
          title,
        })),
      }
    : {}),
})

const applyProjectMdx = (
  item: Partial<ProjectItem>,
  blocks: CvMdxBlocks
): Partial<ProjectItem> => ({
  ...item,
  ...(blocks.links ? { links: blocks.links } : {}),
  ...(blocks.summary ? { summary: blocks.summary.text } : {}),
})

const applyEducationMdx = (
  item: Partial<EducationItem>,
  blocks: CvMdxBlocks
): Partial<EducationItem> => ({
  ...item,
  ...(blocks.thesis ? { thesis: blocks.thesis } : {}),
})

const loadAbout = (rawAbout: RawAbout | undefined) =>
  rawAbout as Pick<CvAboutSection, 'description' | 'label'>

const loadSkills = (
  locale: Locale,
  profile: ProfileSlug,
  rawSkills: RawSkills | undefined,
  context: ContentLoadContext
) => {
  const skills = readProfileModule(locale, profile, 'skills', context)

  return mergeValue(skills, rawSkills) as SkillsContent
}

const loadMdxProfileSection = (
  entry: SectionMdxEntry<ProfileSection>
): ProfileSection => {
  const section = {
    blocks: profileBlocksFromMdx(entry.component, entry.path),
    id: entry.id,
  } satisfies ProfileSection

  return decodeSourceValue(
    CvSchema.contentEntrySchemas.profile,
    section,
    entry.path
  )
}

const localProfileSections = (
  locale: Locale,
  profile: ProfileSlug,
  context: ContentLoadContext
) =>
  discoverMdxSectionEntries<ProfileSection>({
    context,
    locale,
    profile,
    sectionName: 'profile',
  }).map((entry) => loadMdxProfileSection(entry))

const mergeProfileSections = (
  base: readonly ProfileSection[],
  locale: Locale,
  profile: ProfileSlug,
  context: ContentLoadContext
) => {
  const overrides = localProfileSections(locale, profile, context)

  if (overrides.length === 0) {
    return cloneValue(base)
  }

  const overridesById = new Map(
    overrides.map((section) => [section.id, section])
  )
  const merged = base.map(
    (section) => overridesById.get(section.id) ?? cloneValue(section)
  )
  const baseIds = new Set(base.map((section) => section.id))
  const additions = overrides.filter((section) => !baseIds.has(section.id))

  return [...merged, ...additions]
}

const withSectionIndexes = (
  document: CvDocument,
  sections: readonly Omit<CvSection, 'index'>[]
): readonly CvSection[] => {
  const byId = new Map<string, Omit<CvSection, 'index'>>(
    sections.map((section) => [section.id, section])
  )
  const sectionIds = [
    ...document.nav,
    ...sections
      .map((section) => section.id)
      .filter((id) => !document.nav.includes(id)),
  ]

  return sectionIds
    .map((id) => byId.get(id))
    .filter((section): section is Omit<CvSection, 'index'> => Boolean(section))
    .map(
      (section, index) =>
        ({
          ...section,
          index: String(index + 1).padStart(2, '0'),
        }) as CvSection
    )
}

export const finalizeContent = (content: MaterializedCvContent): CvContent => ({
  contact: content.contact,
  document: content.document,
  identity: content.identity,
  profile: content.profile,
  provenance: content.provenance,
  sections: withSectionIndexes(content.document, [
    {
      description: content.about.description,
      id: 'about',
      items: content.profileSections,
      label: content.about.label,
      type: 'profile',
    },
    {
      ...content.experience,
      id: 'experience',
      type: 'experience',
    },
    {
      ...content.projects,
      id: 'projects',
      type: 'projects',
    },
    {
      ...content.skills,
      id: 'skills',
      type: 'skills',
    },
    {
      ...content.education,
      id: 'education',
      type: 'education',
    },
  ]),
})

const materializeBaseProfile = (
  locale: Locale,
  profile: ProfileSlug,
  raw: RawProfileDocument,
  relativePath: string,
  context: ContentLoadContext
): MaterializedCvContent => {
  const localeBase = loadLocaleBase(locale, context)
  const rawProfile = requireField(raw.profile, `${relativePath}.profile`)
  const about = requireField(raw.about, `${relativePath}.about`)
  const content = {
    about: loadAbout(about),
    contact: mergeValue(localeBase.contact, raw.contact),
    document: mergeValue(localeBase.document, raw.document),
    education: materializeBaseMdxSection({
      applyMdx: applyEducationMdx,
      context,
      includeEntryId: false,
      itemSchema: CvSchema.contentEntrySchemas.education,
      locale,
      metaSchema: CvSchema.contentMdxSourceMetaSchemas.education,
      profile,
      raw: mergeValue(localeBase.education, raw.education),
      sectionName: 'education',
      sectionPath: `${relativePath}.education`,
    }),
    experience: materializeBaseMdxSection({
      applyMdx: applyExperienceMdx,
      context,
      itemSchema: CvSchema.contentEntrySchemas.experience,
      locale,
      metaSchema: CvSchema.contentMdxSourceMetaSchemas.experience,
      profile,
      raw: raw.experience,
      sectionName: 'experience',
      sectionPath: `${relativePath}.experience`,
    }),
    identity: mergeValue(localeBase.identity, raw.identity),
    profile: profileMeta(rawProfile, locale, profile),
    profileSections: localProfileSections(locale, profile, context),
    projects: materializeBaseMdxSection({
      applyMdx: applyProjectMdx,
      context,
      itemDefaults: { links: [] },
      itemSchema: CvSchema.contentEntrySchemas.projects,
      locale,
      metaSchema: CvSchema.contentMdxSourceMetaSchemas.projects,
      profile,
      raw: raw.projects,
      sectionName: 'projects',
      sectionPath: `${relativePath}.projects`,
    }),
    provenance: {
      notes: raw.provenance?.notes ?? [
        'Tracked split TS/MDX sources in the private cv-content repository.',
      ],
      source: relativePath,
    } satisfies CvContentProvenance,
    skills: loadSkills(locale, profile, raw.skills, context),
  } satisfies MaterializedCvContent

  return content
}

const mergeAboutOverride = (
  base: Pick<CvAboutSection, 'description' | 'label'>,
  rawAbout: RawAbout | undefined
) => {
  if (!rawAbout) {
    return cloneValue(base)
  }

  return mergeValue(base, rawAbout)
}

const applyProfileOverride = (
  base: MaterializedCvContent,
  locale: Locale,
  profile: ProfileSlug,
  raw: RawProfileDocument,
  relativePath: string,
  context: ContentLoadContext
): MaterializedCvContent => {
  const content = {
    about: mergeAboutOverride(base.about, raw.about),
    contact: mergeValue(base.contact, raw.contact),
    document: mergeValue(base.document, raw.document),
    education: mergeMdxSection({
      applyMdx: applyEducationMdx,
      base: base.education,
      context,
      includeEntryId: false,
      itemSchema: CvSchema.contentEntrySchemas.education,
      locale,
      metaSchema: CvSchema.contentMdxSourceMetaSchemas.education,
      override: raw.education,
      profile,
      sectionName: 'education',
    }),
    experience: mergeMdxSection({
      applyMdx: applyExperienceMdx,
      base: base.experience,
      context,
      itemSchema: CvSchema.contentEntrySchemas.experience,
      locale,
      metaSchema: CvSchema.contentMdxSourceMetaSchemas.experience,
      override: raw.experience,
      profile,
      sectionName: 'experience',
    }),
    identity: mergeValue(base.identity, raw.identity),
    profile: profileMeta(
      mergeValue(base.profile, raw.profile),
      locale,
      profile
    ),
    profileSections: mergeProfileSections(
      base.profileSections,
      locale,
      profile,
      context
    ),
    projects: mergeMdxSection({
      applyMdx: applyProjectMdx,
      base: base.projects,
      context,
      itemDefaults: { links: [] },
      itemSchema: CvSchema.contentEntrySchemas.projects,
      locale,
      metaSchema: CvSchema.contentMdxSourceMetaSchemas.projects,
      override: raw.projects,
      profile,
      sectionName: 'projects',
    }),
    provenance: {
      notes: raw.provenance?.notes ?? base.provenance.notes,
      source: relativePath,
    } satisfies CvContentProvenance,
    skills: loadSkills(locale, profile, raw.skills, context),
  } satisfies MaterializedCvContent

  return content
}

export const loadProfile = (
  locale: Locale,
  profile: ProfileSlug,
  context: ContentLoadContext
): MaterializedCvContent => {
  const cacheKey = `${locale}:${profile}`
  const cached = context.profiles.get(cacheKey)

  if (cached) {
    return cloneValue(cached)
  }

  const manifest = loadProfileManifest(
    locale,
    profile,
    context.sources,
    context.repository
  )
  const defaultProfile = context.repository.config.defaultProfile

  if (!manifest && profile === defaultProfile) {
    throw new Error(`Missing default CV profile document ${profile}/${locale}`)
  }

  const relativePath =
    manifest?.relativePath ??
    `${context.repository.config.contentDir}/profiles/${profile}/${locale}/profile`
  const raw = manifest
    ? decodeSourceValue(
        CvSchema.contentModuleSchemas.profile,
        manifest.data,
        manifest.relativePath
      )
    : {}
  const content =
    profile === defaultProfile
      ? materializeBaseProfile(locale, profile, raw, relativePath, context)
      : (() => {
          const base = loadProfile(locale, defaultProfile, context)

          return applyProfileOverride(
            base,
            locale,
            profile,
            raw,
            relativePath,
            context
          )
        })()

  context.profiles.set(cacheKey, cloneValue(content))

  return content
}
