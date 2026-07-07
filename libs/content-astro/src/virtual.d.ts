declare module 'virtual:content/generated' {
  import type { Locale, ProfileSlug } from '@cv/content-core'

  export type PrivateContentRoute = {
    lang: Locale
    profile: ProfileSlug
    profileId: string
  }

  export const privateContentRoutes: readonly PrivateContentRoute[]
  export const getLocales: () => readonly Locale[]
  export const getPrivateRoutes: () => readonly PrivateContentRoute[]
}

declare module 'virtual:content/generated/runtime' {
  import type { ContentFileIndex, Locale, ProfileSlug } from '@cv/content-core'
  import type { PrivateRuntimeProfile } from '@cv/private-content-protocol/types'

  export type GetContentOptions = {
    locale?: Locale
    profile?: ProfileSlug
  }

  export type LoadPrivateRuntimeProfileOptions = {
    locale: Locale
    selector: string
  }

  export const defaultLocale: Locale
  export const privateContentFileIndex: ContentFileIndex

  export const getContent: <Content = unknown>(
    options?: GetContentOptions
  ) => Content
  export const getLocales: () => readonly Locale[]
  export const loadPrivateRuntimeProfile: (
    options: LoadPrivateRuntimeProfileOptions
  ) => Promise<PrivateRuntimeProfile | null>
}
