import type {
  Locale,
  ProfileSlug,
  VariableUseDescriptor,
} from '@cv/content-core'
import type { ContentRegistry, MdxModule } from './content-registry/types'
import type {
  ComposeContentResult,
  ContentComposeOutput,
} from './manifest/types'
import {
  type ContentRepository,
  type ContentSectionSource,
  loadContentRepository,
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
  defaultLocale: Locale
  defaultProfile: ProfileSlug
  privacy?: ContentPrivacyAdapter<Content>
  schema: string
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
  const repository = loadContentRepository(registry, {
    defaultLocale: contract.defaultLocale,
    defaultProfile: contract.defaultProfile,
  })

  return {
    ...contract.compose({
      repository,
      sources: createContentSourceReader(registry),
    }),
    repository,
  }
}
