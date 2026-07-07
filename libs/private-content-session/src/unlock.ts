import {
  applyContentOverlay,
  type ContentOverlay,
  type Locale,
  type VariableValue,
} from '@cv/content-core'
import type {
  ContentEncryptionKey,
  PrivateCryptoError,
  WebCryptoApi,
} from '@cv/private-content-crypto'
import {
  type OpenedPrivateRuntimeProfile,
  openRuntimeProfileEntry,
  PrivateRuntimeManifestError,
  type PrivateRuntimeProfile,
  type PrivateRuntimeProfilePayload,
} from '@cv/private-content-protocol'
import type { PrivateCapability } from '@cv/private-content-tokens'
import { Effect } from 'effect'

export type PrivateContentFileKeys = {
  readonly profileContentKey: ContentEncryptionKey
}

export type PrivateContentVariableMap = Record<string, VariableValue>

export type PrivateContentUnlockResult<Content> = {
  readonly content: Content
  readonly fileKeys: PrivateContentFileKeys
  readonly profileId: string
  readonly variables: PrivateContentVariableMap
}

export type PrivateContentUnlockProfileOptions<Content> = {
  readonly capability: PrivateCapability
  readonly locale: Locale
  readonly profile: PrivateRuntimeProfile
  readonly publicContent: Content
}

export type PrivateContentUnlockError =
  | PrivateCryptoError
  | PrivateRuntimeManifestError

type PrivateContentPayloadInput<Content> = {
  readonly profilePayload: PrivateRuntimeProfilePayload
  readonly locale: Locale
  readonly publicContent: Content
}

type PrivateContentVariablesInput = {
  readonly profilePayload: PrivateRuntimeProfilePayload
  readonly locale: Locale
}

type UnlockedResultInput<Content> = {
  readonly capability: PrivateCapability
  readonly locale: Locale
  readonly opened: OpenedPrivateRuntimeProfile
  readonly publicContent: Content
}

const applyPrivateContentPayload = <Content>({
  locale,
  profilePayload,
  publicContent,
}: PrivateContentPayloadInput<Content>): Content =>
  applyContentOverlay(
    publicContent,
    profilePayload.content[locale] as ContentOverlay | undefined
  )

const privateContentVariablesForLocale = ({
  locale,
  profilePayload,
}: PrivateContentVariablesInput): PrivateContentVariableMap =>
  Object.fromEntries(
    profilePayload.variables.flatMap((variable) => {
      const value = variable.value?.[locale]

      return value ? [[variable.id, value]] : []
    })
  )

const unlockedResult = <Content>({
  capability,
  locale,
  opened,
  publicContent,
}: UnlockedResultInput<Content>): PrivateContentUnlockResult<Content> => ({
  content: applyPrivateContentPayload({
    locale,
    profilePayload: opened.profile,
    publicContent,
  }),
  fileKeys: {
    profileContentKey: capability.profileContentKey,
  },
  profileId: opened.profileId,
  variables: privateContentVariablesForLocale({
    locale,
    profilePayload: opened.profile,
  }),
})

export const unlockPrivateContentProfile = <Content>({
  capability,
  locale,
  profile,
  publicContent,
}: PrivateContentUnlockProfileOptions<Content>): Effect.Effect<
  PrivateContentUnlockResult<Content>,
  PrivateContentUnlockError,
  WebCryptoApi
> => {
  if (profile.locale !== locale) {
    return Effect.fail(
      new PrivateRuntimeManifestError({
        message: 'Private runtime profile locale does not match this session',
      })
    )
  }

  return openRuntimeProfileEntry(profile, capability.profileContentKey).pipe(
    Effect.map((opened) =>
      unlockedResult({
        capability,
        locale,
        opened,
        publicContent,
      })
    )
  )
}
