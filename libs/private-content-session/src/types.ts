import type { ContentFileIndex, Locale, ProfileSlug } from '@cv/content-core'
import type { PrivateRuntimeProfile } from '@cv/private-content-protocol'
import type {
  PrivateContentFileKeys,
  PrivateContentVariableMap,
} from './unlock'

export type LoadPrivateRuntimeProfileOptions = {
  readonly locale: Locale
  readonly selector: string
}

export type ReadContentOptions = {
  readonly locale: Locale
  readonly profile: ProfileSlug
}

export type ContentPageContext = {
  readonly audience?: string
  readonly contentProfile?: ProfileSlug
  readonly locale: Locale
  readonly profile: ProfileSlug
  readonly profileId?: string
}

export type ContentSessionRoute = {
  readonly audienceId: string
  readonly profileId?: string
  readonly token: string | null
}

export type ContentSessionStatus =
  | 'public'
  | 'loading'
  | 'unlocked'
  | 'invalid'
  | 'unavailable'

export type ContentCatalog<Content> = {
  readonly fileIndex: ContentFileIndex
  readonly loadPrivateRuntimeProfile: (
    options: LoadPrivateRuntimeProfileOptions
  ) => Promise<PrivateRuntimeProfile | null>
  readonly readContent: (options: ReadContentOptions) => Content
}

export type ContentSession<
  Content = unknown,
  Page extends ContentPageContext = ContentPageContext,
> = {
  readonly content: Content
  readonly files: ContentFileIndex
  readonly page: Page
  readonly private: {
    readonly fileKeys: PrivateContentFileKeys | null
    readonly variables: PrivateContentVariableMap
  }
  readonly route: ContentSessionRoute | null
  readonly status: ContentSessionStatus
}
