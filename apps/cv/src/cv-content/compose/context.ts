import type {
  ContentComposeContext,
  ContentRepository,
} from '@cv/content-composer'
import { cloneValue } from '@cv/content-composer'
import type { Locale, ProfileSlug } from '@cv/content-core'
import type {
  CvAboutSection,
  CvContent,
  CvSectionList,
  EducationItem,
  ExperienceItem,
  ProfileSection,
  ProjectItem,
  SkillsContent,
} from '../model'
import * as CvSchema from '../schema/registry'
import type {
  ContentEntries,
  ContentModules,
  LocaleBaseContent,
} from '../schema/source'

export type ContentValueSchema<Value> = Parameters<
  typeof CvSchema.decodeCvContentSchema<Value>
>[0]

export type SectionName = Exclude<keyof ContentEntries, 'profile'>

export type MaterializedCvContent = Omit<CvContent, 'sections'> & {
  about: Pick<CvAboutSection, 'description' | 'label'>
  education: CvSectionList<EducationItem>
  experience: CvSectionList<ExperienceItem>
  profileSections: readonly ProfileSection[]
  projects: CvSectionList<ProjectItem>
  skills: SkillsContent
}

export type ContentLoadContext = {
  localeBase: Map<string, LocaleBaseContent>
  profiles: Map<string, MaterializedCvContent>
  repository: ContentRepository
  sectionItems: Map<SectionName, Map<string, object>>
  sources: ContentComposeContext['sources']
}

export const decodeSourceValue = <Value>(
  schema: ContentValueSchema<Value>,
  value: unknown,
  context: string
): Value => CvSchema.decodeCvContentSchema(schema, value, context)

export const createContentContext = ({
  repository,
  sources,
}: ContentComposeContext): ContentLoadContext => ({
  localeBase: new Map(),
  profiles: new Map(),
  repository,
  sectionItems: new Map(),
  sources,
})

export const sectionItemCache = <Item extends object>(
  context: ContentLoadContext,
  name: SectionName
) => {
  const cached = context.sectionItems.get(name)

  if (cached) {
    return cached as Map<string, Partial<Item>>
  }

  const cache = new Map<string, Partial<Item>>()
  context.sectionItems.set(name, cache as Map<string, object>)

  return cache
}

export const readLocaleModule = <Name extends keyof ContentModules>(
  locale: Locale,
  name: Name,
  context: ContentLoadContext
) =>
  readProfileModule(
    locale,
    context.repository.config.defaultProfile,
    name,
    context
  )

export const readProfileModule = <Name extends keyof ContentModules>(
  locale: Locale,
  profile: ProfileSlug,
  name: Name,
  context: ContentLoadContext
) => {
  const section = context.repository.getEffectiveSection(locale, profile, [
    name,
  ])

  if (!section) {
    throw new Error(`Missing content section ${profile}/${locale}/${name}`)
  }

  const source = context.sources.readModule<unknown>(
    section,
    `${profile}/${locale}/${name}`
  )

  return decodeSourceValue(
    CvSchema.contentModuleSchemas[name] as unknown as ContentValueSchema<
      ContentModules[Name]
    >,
    source.data,
    source.relativePath
  )
}

export const loadLocaleBase = (
  locale: Locale,
  context: ContentLoadContext
): LocaleBaseContent => {
  const cached = context.localeBase.get(locale)

  if (cached) {
    return cloneValue(cached) as LocaleBaseContent
  }

  const base = {
    contact: readLocaleModule(locale, 'contact', context),
    document: readLocaleModule(locale, 'document', context),
    education: readLocaleModule(locale, 'education', context),
    identity: readLocaleModule(locale, 'identity', context),
  } satisfies LocaleBaseContent

  context.localeBase.set(locale, cloneValue(base))

  return base
}
