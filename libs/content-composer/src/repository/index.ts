import {
  type Locale,
  localeSchema,
  type ProfileSlug,
  profileSlugSchema,
} from '@cv/content-core'
import { Schema } from 'effect'
import { readContentModule } from '../content-registry/modules'
import type { ContentRegistry } from '../content-registry/types'
import {
  contentSectionKey,
  discoverSourceSections,
  profilesFromSections,
} from './discovery'
import type {
  ContentRepository,
  ContentRepositoryConfig,
  ContentRepositoryOptions,
  ContentSectionSource,
  ResolvedContentRepositoryConfig,
} from './types'

export type {
  ContentRepository,
  ContentRepositoryConfig,
  ContentRepositoryOptions,
  ContentSectionKind,
  ContentSectionLookup,
  ContentSectionSource,
  ResolvedContentRepositoryConfig,
} from './types'

const normalizeDirectory = (path: string | undefined) =>
  (path?.trim() ?? '')
    .replace(/\\/gu, '/')
    .replace(/^\/+/u, '')
    .replace(/\/+$/u, '')

const joinPath = (...parts: readonly string[]) =>
  parts.filter(Boolean).join('/')

const loadRepositoryConfigModule = (registry: ContentRegistry) =>
  Schema.decodeUnknownSync(
    Schema.Struct({
      locales: Schema.Array(localeSchema),
      publicProfiles: Schema.optional(Schema.Array(profileSlugSchema)),
    }),
    { errors: 'all' }
  )(readContentModule<ContentRepositoryConfig>('content.config', registry).data)

const resolveRepositoryConfig = (
  registry: ContentRegistry,
  options: ContentRepositoryOptions
) => {
  const source = loadRepositoryConfigModule(registry)
  const contentDir = normalizeDirectory(options.contentDir)
  const contentDirSegments = contentDir.split('/').filter(Boolean)

  if (
    contentDirSegments.length === 0 ||
    contentDirSegments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(
      'Content contract must define a repository-relative content directory.'
    )
  }

  if (source.locales.length === 0) {
    throw new Error(
      'Content repository config must define at least one locale.'
    )
  }

  if (!source.locales.includes(options.defaultLocale)) {
    throw new Error(
      `Content repository config must include the default locale "${options.defaultLocale}".`
    )
  }

  return {
    config: {
      contentDir,
      defaultLocale: options.defaultLocale,
      defaultProfile: options.defaultProfile,
      locales: source.locales,
      publicProfiles: source.publicProfiles ?? [options.defaultProfile],
    } satisfies ResolvedContentRepositoryConfig,
    profileRootPath: joinPath(contentDir, 'profiles'),
  }
}

const createSourceIndex = (sections: readonly ContentSectionSource[]) =>
  new Map(
    sections.map((section) => [
      contentSectionKey(section.locale, section.profile, section.path),
      section,
    ])
  )

const hasDefaultProfileSource = (
  sections: readonly ContentSectionSource[],
  config: ResolvedContentRepositoryConfig
) =>
  sections.some(
    (section) =>
      section.locale === config.defaultLocale &&
      section.profile === config.defaultProfile
  )

const assertDefaultProfileSource = (
  sections: readonly ContentSectionSource[],
  config: ResolvedContentRepositoryConfig
) => {
  if (!hasDefaultProfileSource(sections, config)) {
    throw new Error(
      `Default content profile "${config.defaultProfile}" was not discovered for locale "${config.defaultLocale}".`
    )
  }
}

const isDirectChildPath = (
  path: readonly string[],
  parentPath: readonly string[]
) =>
  path.length === parentPath.length + 1 &&
  parentPath.every((part, index) => path[index] === part)

const sortSections = (sections: readonly ContentSectionSource[]) =>
  [...sections].sort((left, right) =>
    left.path.join('/').localeCompare(right.path.join('/'))
  )

export const loadContentRepository = (
  registry: ContentRegistry,
  options: ContentRepositoryOptions
): ContentRepository => {
  const { config, profileRootPath } = resolveRepositoryConfig(registry, options)
  const sourceSections = discoverSourceSections(
    registry,
    profileRootPath,
    config.locales
  )
  const sourceByKey = createSourceIndex(sourceSections)
  const profiles = profilesFromSections(sourceSections)

  if (profiles.length === 0) {
    throw new Error(
      `No content profiles were discovered under ${profileRootPath || '<content root>'}.`
    )
  }

  assertDefaultProfileSource(sourceSections, config)

  const getSourceSection = (
    locale: Locale,
    profile: ProfileSlug,
    path: readonly string[]
  ) => sourceByKey.get(contentSectionKey(locale, profile, path))

  const getEffectiveSection = (
    locale: Locale,
    profile: ProfileSlug,
    path: readonly string[]
  ) => {
    const local = getSourceSection(locale, profile, path)

    if (local || profile === config.defaultProfile) {
      return local
    }

    const base = getSourceSection(locale, config.defaultProfile, path)

    return base
      ? {
          ...base,
          profile,
          sourceProfile: base.profile,
        }
      : undefined
  }

  const listSourceChildren = (
    locale: Locale,
    profile: ProfileSlug,
    path: readonly string[]
  ) =>
    sortSections(
      sourceSections.filter(
        (section) =>
          section.locale === locale &&
          section.profile === profile &&
          isDirectChildPath(section.path, path)
      )
    )

  return {
    config,
    getEffectiveSection,
    getSourceSection,
    listSourceChildren,
    profiles,
  }
}
