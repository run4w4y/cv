import type { Locale, ProfileSlug } from '@cv/content-core'
import { listContentFiles } from '../content-registry/modules'
import type { ContentRegistry } from '../content-registry/types'
import type { ContentSectionKind, ContentSectionSource } from './types'

const contentModulePattern = /\.(?<extension>mdx|tsx?|jsx?)$/u
const declarationModulePattern = /\.d\.tsx?$/u
const testModulePattern = /\.(?:test|spec)\.(?:mdx|tsx?|jsx?)$/u

const sorted = <Value extends string>(values: Iterable<Value>) =>
  [...values].sort((left, right) => left.localeCompare(right))

const startsWithPath = (path: string, prefix: string) =>
  prefix.length === 0 ? true : path === prefix || path.startsWith(`${prefix}/`)

const withoutPrefix = (path: string, prefix: string) =>
  prefix.length === 0 ? path : path.slice(prefix.length + 1)

export const contentSectionKey = (
  locale: Locale,
  profile: ProfileSlug,
  path: readonly string[]
) => `${locale}/${profile}/${path.join('/')}`

const sectionPathFromParts = (parts: readonly string[]) => {
  const relativePath = parts.join('/')
  const match = relativePath.match(contentModulePattern)

  if (
    !match?.groups ||
    declarationModulePattern.test(relativePath) ||
    testModulePattern.test(relativePath)
  ) {
    return null
  }

  const withoutExtension = relativePath.replace(contentModulePattern, '')
  const path = withoutExtension.split('/').filter(Boolean)
  const leaf = path.at(-1)

  if (!leaf) {
    return null
  }

  return {
    kind: match.groups.extension === 'mdx' ? 'mdx' : 'module',
    path: leaf === 'index' ? path.slice(0, -1) : path,
  } satisfies { kind: ContentSectionKind; path: readonly string[] }
}

const parseContentSectionFile = (
  file: string,
  profileRootPath: string,
  localeSet: ReadonlySet<Locale>
): ContentSectionSource | null => {
  if (!startsWithPath(file, profileRootPath)) {
    return null
  }

  const [profile, locale, ...sectionParts] = withoutPrefix(
    file,
    profileRootPath
  ).split('/')

  if (!profile || !localeSet.has(locale)) {
    return null
  }

  const section = sectionPathFromParts(sectionParts)

  if (!section || section.path.length === 0) {
    return null
  }

  return {
    id: section.path.at(-1) ?? section.path.join('/'),
    kind: section.kind,
    locale,
    modulePath: file,
    path: section.path,
    profile,
    sourceProfile: profile,
  }
}

export const discoverSourceSections = (
  registry: ContentRegistry,
  profileRootPath: string,
  locales: readonly Locale[]
) => {
  const localeSet = new Set(locales)
  const sections = new Map<string, ContentSectionSource>()

  for (const file of listContentFiles(registry)) {
    const section = parseContentSectionFile(file, profileRootPath, localeSet)

    if (!section) {
      continue
    }

    const key = contentSectionKey(section.locale, section.profile, section.path)
    const existing = sections.get(key)

    if (existing) {
      throw new Error(
        `Duplicate content section "${section.path.join('/')}" for ${section.profile}/${section.locale}: ${existing.modulePath}, ${section.modulePath}`
      )
    }

    sections.set(key, section)
  }

  return [...sections.values()].sort((left, right) =>
    contentSectionKey(left.locale, left.profile, left.path).localeCompare(
      contentSectionKey(right.locale, right.profile, right.path)
    )
  )
}

export const profilesFromSections = (
  sections: readonly ContentSectionSource[]
) => sorted(new Set(sections.map((section) => section.profile)))
