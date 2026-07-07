import type { VariableValue } from '@cv/content-core'
import type { ContentEncryptionKey } from '@cv/private-content-crypto'
import type { Schema } from 'effect'
import type {
  PRIVATE_RUNTIME_SCHEMA,
  privateRuntimeLocaleContentSchema,
  privateRuntimeManifestSchema,
  privateRuntimeProfilePayloadSchema,
  privateSharedVariableSchema,
} from './schema'

export type { EncryptedPayload } from '@cv/private-content-crypto'
export { PRIVATE_RUNTIME_SCHEMA } from './schema'

export type PrivateRuntimeSchema = typeof PRIVATE_RUNTIME_SCHEMA

export type PrivateRuntimeLocaleContent = Schema.Schema.Type<
  typeof privateRuntimeLocaleContentSchema
>

export type PrivateSharedVariableValue = VariableValue

export type PrivateSharedVariable = Schema.Schema.Type<
  typeof privateSharedVariableSchema
>

export type PrivateProfileSource = {
  readonly content: Record<string, PrivateRuntimeLocaleContent>
  readonly contentKey: ContentEncryptionKey
  readonly id: string
  readonly locale: string
  readonly profile: string
  readonly variables: readonly PrivateSharedVariable[]
}

export type PrivateRuntimeBuildInput = {
  readonly profiles: readonly PrivateProfileSource[]
}

export type PrivateRuntimeManifest = Schema.Schema.Type<
  typeof privateRuntimeManifestSchema
>

export type PrivateRuntimeProfile = PrivateRuntimeManifest['profiles'][number]

export type PrivateRuntimeProfilePayload = Schema.Schema.Type<
  typeof privateRuntimeProfilePayloadSchema
>

export type OpenedPrivateRuntimeProfile = {
  profileId: PrivateRuntimeProfile['id']
  profileSlug: PrivateRuntimeProfile['profile']
  profile: PrivateRuntimeProfilePayload
}
