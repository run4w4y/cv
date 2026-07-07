import type { ContentManifest } from '@cv/content-core'
import type { ContentRepository } from '../repository'

export type ContentComposeOutput<Content = unknown> = {
  manifest: ContentManifest<Content>
}

export type ComposeContentResult<Content = unknown> =
  ContentComposeOutput<Content> & {
    repository: ContentRepository
  }
