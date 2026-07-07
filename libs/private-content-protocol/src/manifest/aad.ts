import type { Locale } from '@cv/content-core'
import { utf8ToBytes } from '@cv/private-content-crypto'

export const privateRuntimeProfileAssociatedData = (
  profileId: string,
  locale: Locale
) => `private-content-runtime-profile:v1:${profileId}:${locale}`

export const privateRuntimeProfileFileAssociatedData = (
  profile: string,
  path: string
) => `private-content-file:v1:profile:${profile}:${path}`

export const runtimeProfileAad = (profileId: string, locale: Locale) =>
  utf8ToBytes(privateRuntimeProfileAssociatedData(profileId, locale))

export const runtimeProfileFileAad = (profile: string, path: string) =>
  utf8ToBytes(privateRuntimeProfileFileAssociatedData(profile, path))
