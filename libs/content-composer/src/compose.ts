import type {
  ContentManifest,
  Locale,
  ProfileSlug,
  VariableUseDescriptor,
} from '@cv/content-core'
import { contentManifestSchemaVersion } from '@cv/content-core'
import { Schema } from 'effect'
import type { ContentRegistry, MdxModule } from './content-registry/types'
import type {
  ComposeContentResult,
  ContentComposeOutput,
} from './manifest/types'
import {
  type ContentRepository,
  type ContentSectionSource,
  loadContentRepository,
  type ResolvedContentRepositoryConfig,
} from './repository'

export type ContentVariableCollectionContext<Content = unknown> = {
  content: Content
  locale: Locale
  profile: ProfileSlug
}

export type ContentPrivacyAdapter<Content = unknown> = {
  collectVariables?: (
    context: ContentVariableCollectionContext<Content>
  ) => readonly VariableUseDescriptor[]
}

export type ContentSourceReader = {
  readMdx: <Meta = Record<string, unknown>>(
    section: ContentSectionSource,
    context?: string
  ) => {
    component: MdxModule<Meta>['default']
    meta: Meta
    relativePath: string
  }
  readModule: <Content = unknown>(
    section: ContentSectionSource,
    context?: string
  ) => {
    data: Content
    relativePath: string
  }
}

export type ContentComposeContext = {
  repository: ContentRepository
  sources: ContentSourceReader
}

export type ContentContract<Content = unknown> = {
  authoringModule: string
  compose: (context: ContentComposeContext) => ContentComposeOutput<Content>
  contentSchema: Schema.Codec<Content, unknown>
  contentSchemaVersion: string
  privacy?: ContentPrivacyAdapter<Content>
}

const assertUnique = (label: string, values: readonly string[]) => {
  const duplicate = values.find(
    (value, index) => values.indexOf(value) !== index
  )

  if (duplicate) {
    throw new Error(
      `Content manifest contains duplicate ${label} "${duplicate}".`
    )
  }
}

const assertJsonValue = (
  value: unknown,
  path: string,
  active: WeakSet<object>
): void => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Content at ${path} contains a non-finite number.`)
    }
    return
  }

  if (typeof value !== 'object') {
    throw new Error(
      `Content at ${path} is not JSON-serializable (${typeof value}).`
    )
  }

  if (active.has(value)) {
    throw new Error(`Content at ${path} contains a cyclic reference.`)
  }

  const prototype = Object.getPrototypeOf(value)
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw new Error(`Content at ${path} contains a non-JSON object.`)
  }

  active.add(value)
  for (const [key, child] of Object.entries(value)) {
    assertJsonValue(child, `${path}.${key}`, active)
  }
  active.delete(value)
}

const validateManifest = <Content>(
  source: ContentComposeOutput<Content>['manifest'],
  contract: ContentContract<Content>,
  repositoryConfig: ResolvedContentRepositoryConfig
): ContentManifest<Content> => {
  const { defaultLocale, defaultProfile } = repositoryConfig

  assertUnique('locale', source.locales)
  assertUnique('profile', source.profiles)

  if (!source.locales.includes(defaultLocale)) {
    throw new Error(
      `Content manifest must include the default locale "${defaultLocale}".`
    )
  }

  if (!source.profiles.includes(defaultProfile)) {
    throw new Error(
      `Content manifest must include the default profile "${defaultProfile}".`
    )
  }

  const localeSet = new Set(source.locales)
  const profileSet = new Set(source.profiles)
  const decodeContent = Schema.decodeUnknownSync(contract.contentSchema, {
    errors: 'all',
  })
  const content = Object.fromEntries(
    Object.entries(source.content).map(([locale, profiles]) => {
      if (!localeSet.has(locale)) {
        throw new Error(
          `Content manifest has content for undeclared locale "${locale}".`
        )
      }

      return [
        locale,
        Object.fromEntries(
          Object.entries(profiles).map(([profile, value]) => {
            if (!profileSet.has(profile)) {
              throw new Error(
                `Content manifest has content for undeclared profile "${profile}".`
              )
            }

            const decoded = decodeContent(value)
            assertJsonValue(
              decoded,
              `content.${locale}.${profile}`,
              new WeakSet()
            )
            return [profile, decoded]
          })
        ),
      ]
    })
  )

  for (const locale of source.locales) {
    if (!Object.hasOwn(content, locale)) {
      throw new Error(
        `Content manifest has no content record for declared locale "${locale}".`
      )
    }
  }

  for (const profile of source.profiles) {
    if (
      !Object.values(content).some((profiles) =>
        Object.hasOwn(profiles, profile)
      )
    ) {
      throw new Error(
        `Content manifest has no content for declared profile "${profile}".`
      )
    }
  }

  if (
    !Object.hasOwn(content, defaultLocale) ||
    !Object.hasOwn(content[defaultLocale] ?? {}, defaultProfile)
  ) {
    throw new Error(
      `Content manifest must contain ${defaultProfile}/${defaultLocale}.`
    )
  }

  return {
    content,
    contentSchema: contract.contentSchemaVersion,
    locales: [...source.locales],
    profiles: [...source.profiles],
    schema: contentManifestSchemaVersion,
  }
}

const sectionContext = (section: ContentSectionSource, context?: string) =>
  context ?? `${section.profile}/${section.locale}/${section.path.join('/')}`

const createContentSourceReader = (
  registry: ContentRegistry
): ContentSourceReader => ({
  readMdx: <Meta = Record<string, unknown>>(
    section: ContentSectionSource,
    context?: string
  ) => {
    const relativePath = section.modulePath
    const module = registry.mdxModules[relativePath] as
      | MdxModule<Meta>
      | undefined

    if (!module?.default) {
      throw new Error(
        `${relativePath} must be an MDX section for ${sectionContext(section, context)}.`
      )
    }

    return {
      component: module.default,
      meta: (module.meta ?? {}) as Meta,
      relativePath,
    }
  },
  readModule: <Content = unknown>(
    section: ContentSectionSource,
    context?: string
  ) => {
    const relativePath = section.modulePath
    const module = registry.modules[relativePath]

    if (!module) {
      throw new Error(
        `${relativePath} must be a TS/JS module section for ${sectionContext(section, context)}.`
      )
    }

    return {
      data: module.default as Content,
      relativePath,
    }
  },
})

export const composeContent = <Content>(
  registry: ContentRegistry,
  contract: ContentContract<Content>
): ComposeContentResult<Content> => {
  if (!contract.contentSchemaVersion.trim()) {
    throw new Error('Content contract must define a content schema version.')
  }

  const repository = loadContentRepository(registry)

  const output = contract.compose({
    repository,
    sources: createContentSourceReader(registry),
  })

  return {
    manifest: validateManifest(output.manifest, contract, repository.config),
    repository,
  }
}
