import { variableValueSchema } from '@cv/content-core'
import { Schema } from 'effect'

export const PRIVATE_RUNTIME_SCHEMA = 'private-content.runtime.v1' as const

export const encryptedPayloadSchema = Schema.Struct({
  alg: Schema.Literal('AES-GCM'),
  ciphertext: Schema.NonEmptyString,
  compression: Schema.Literal('gzip'),
  iv: Schema.NonEmptyString,
})

const arraySchema = <Item extends Schema.Schema<unknown>>(item: Item) =>
  Schema.Array(item)
export const privateRuntimeLocaleContentSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
)

const privateLocaleContentRecordSchema = Schema.Record(
  Schema.NonEmptyString,
  privateRuntimeLocaleContentSchema
)

export const privateSharedVariableSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  id: Schema.NonEmptyString,
  value: Schema.optional(
    Schema.Record(Schema.NonEmptyString, variableValueSchema)
  ),
})

export const privateRuntimeProfileSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  locale: Schema.NonEmptyString,
  payload: encryptedPayloadSchema,
  profile: Schema.NonEmptyString,
  selector: Schema.NonEmptyString,
})

export const privateRuntimeProfilePayloadSchema = Schema.Struct({
  content: privateLocaleContentRecordSchema,
  locale: Schema.NonEmptyString,
  variables: arraySchema(privateSharedVariableSchema),
})

export const privateRuntimeManifestSchema = Schema.Struct({
  generatedAt: Schema.NonEmptyString,
  profiles: arraySchema(privateRuntimeProfileSchema),
  schema: Schema.Literal(PRIVATE_RUNTIME_SCHEMA),
  version: Schema.Literal(1),
})

export const decodePrivateRuntimeManifest = Schema.decodeUnknownEffect(
  privateRuntimeManifestSchema,
  { errors: 'all' }
)
