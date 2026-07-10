import type { ContentManifest, Locale, ProfileSlug } from '@cv/content-core'
import type { ContentRepository } from '../repository'

export type ContentComposeOutput<Content = unknown> = {
  manifest: {
    readonly content: Record<Locale, Partial<Record<ProfileSlug, Content>>>
    readonly locales: readonly Locale[]
    readonly profiles: readonly ProfileSlug[]
  }
}

export type ComposeContentResult<Content = unknown> = {
  manifest: ContentManifest<Content>
  repository: ContentRepository
}
