import { Schema } from 'effect'
import {
  CvLocaleSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  Sha256HexSchema,
  ShortTextSchema,
} from '../internal/primitives'

export const opaqueContentEnvelopeVersion = 1 as const

export const ContractNameSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/u))
).annotate({
  identifier: 'CvContractName',
  title: 'Contract name',
  description:
    'Version-independent contract name, for example cv.document or cv.facts.',
})

export type ContractName = Schema.Schema.Type<typeof ContractNameSchema>

export const ContractReferenceSchema = Schema.Struct({
  id: ContractNameSchema,
  version: PositiveIntegerSchema.annotate({
    title: 'Contract version',
    description: 'Positive immutable version of the referenced contract.',
  }),
}).annotate({
  identifier: 'CvContractReference',
  title: 'Contract reference',
})

export type ContractReference = Schema.Schema.Type<
  typeof ContractReferenceSchema
>

export const MediaTypeSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[^\s=]+=[^;]+)*$/iu
    )
  )
).annotate({
  identifier: 'CvMediaType',
  title: 'Media type',
  description: 'IANA-style media type for the opaque bytes.',
})

export type MediaType = Schema.Schema.Type<typeof MediaTypeSchema>

export const ObjectKeySchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1_024),
    Schema.isPattern(/^[^\\/][^\\]*$/u),
    Schema.makeFilter(
      (key: string) =>
        key
          .split('/')
          .every(
            (segment) => segment !== '' && segment !== '.' && segment !== '..'
          ),
      {
        message:
          'Object key must be relative and may not contain empty or dot segments',
      }
    )
  )
).annotate({
  identifier: 'CvObjectKey',
  title: 'Object key',
  description: 'Validated relative key in an opaque object store.',
})

export type ObjectKey = Schema.Schema.Type<typeof ObjectKeySchema>

export const OpaquePayloadMetadataSchema = Schema.Struct({
  contract: ContractReferenceSchema,
  locale: CvLocaleSchema,
  mediaType: MediaTypeSchema,
  sha256: Sha256HexSchema,
  byteLength: NonNegativeIntegerSchema.annotate({
    title: 'Byte length',
    description: 'Exact encoded payload length in bytes.',
  }),
}).annotate({
  identifier: 'OpaquePayloadMetadata',
  title: 'Opaque payload metadata',
  description:
    'Metadata the backend may inspect without knowing the payload contract shape.',
})

export type OpaquePayloadMetadata = Schema.Schema.Type<
  typeof OpaquePayloadMetadataSchema
>

export const OpaqueObjectReferenceSchema = Schema.Struct({
  key: ObjectKeySchema,
  etag: Schema.optional(
    ShortTextSchema.annotate({
      title: 'Entity tag',
      description: 'Optional object-store entity tag used for verification.',
    })
  ),
  version: Schema.optional(
    ShortTextSchema.annotate({
      title: 'Object version',
      description: 'Optional provider-neutral immutable object version.',
    })
  ),
}).annotate({
  identifier: 'OpaqueObjectReference',
  title: 'Opaque object reference',
  description: 'Provider-neutral reference to stored opaque bytes.',
})

export type OpaqueObjectReference = Schema.Schema.Type<
  typeof OpaqueObjectReferenceSchema
>

export const OpaqueInlineContentEnvelopeSchema = Schema.Struct({
  envelopeVersion: Schema.Literal(opaqueContentEnvelopeVersion),
  kind: Schema.Literal('inline'),
  metadata: OpaquePayloadMetadataSchema,
  payload: Schema.Json.annotate({
    title: 'Opaque JSON payload',
    description:
      'JSON accepted for transport without interpreting its contract-specific fields.',
  }),
}).annotate({
  identifier: 'OpaqueInlineContentEnvelopeV1',
  title: 'Opaque inline content envelope v1',
  description:
    'An opaque JSON payload carried inline with inspectable metadata.',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
})

export type OpaqueInlineContentEnvelope = Schema.Schema.Type<
  typeof OpaqueInlineContentEnvelopeSchema
>

export const OpaqueStoredContentEnvelopeSchema = Schema.Struct({
  envelopeVersion: Schema.Literal(opaqueContentEnvelopeVersion),
  kind: Schema.Literal('stored'),
  metadata: OpaquePayloadMetadataSchema,
  object: OpaqueObjectReferenceSchema,
}).annotate({
  identifier: 'OpaqueStoredContentEnvelopeV1',
  title: 'Opaque stored content envelope v1',
  description:
    'A reference to opaque stored bytes accompanied by inspectable metadata.',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
})

export type OpaqueStoredContentEnvelope = Schema.Schema.Type<
  typeof OpaqueStoredContentEnvelopeSchema
>

export const OpaqueContentEnvelopeSchema = Schema.Union([
  OpaqueInlineContentEnvelopeSchema,
  OpaqueStoredContentEnvelopeSchema,
]).annotate({
  identifier: 'OpaqueContentEnvelopeV1',
  title: 'Opaque content envelope v1',
  description:
    'Inline or stored opaque content with provider-neutral metadata.',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
})

export type OpaqueContentEnvelope = Schema.Schema.Type<
  typeof OpaqueContentEnvelopeSchema
>
