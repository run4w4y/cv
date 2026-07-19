import {
  type ContentEntry,
  ContentEntryKindSchema,
  ContentEntrySchema,
  type ContentRevision,
  ContentRevisionSchema,
  ContentRevisionSourceSchema,
  type CvLink,
  CvLinkSchema,
  ExpectedApplicationVersionSchema,
  type FactsChannel,
  FactsChannelSchema,
  type FactsRelease,
  type FactsReleaseAsset,
  FactsReleaseAssetSchema,
  type FactsReleaseCatalog,
  FactsReleaseCatalogSchema,
  FactsReleaseSchema,
  type GeneratedArtifact,
  GeneratedArtifactSchema,
  type JobPostingSnapshot,
  JobPostingSnapshotSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
} from '@cv/application-registry-entity'
import { type CvLocale, CvLocaleSchema } from '@cv/contracts/facts'
import { Schema } from 'effect'

export const RegistryContentLocaleSchema = CvLocaleSchema

const Base64Schema = Schema.String.pipe(
  Schema.check(
    Schema.isMaxLength(16 * 1_024 * 1_024),
    Schema.isPattern(/^(?:[a-z\d+/]{4})*(?:[a-z\d+/]{2}==|[a-z\d+/]{3}=)?$/iu)
  )
)

export const OpaquePayloadRequestSchema = Schema.Struct({
  data: Base64Schema,
  mediaType: NonEmptyString,
})
export type OpaquePayloadRequest = Schema.Schema.Type<
  typeof OpaquePayloadRequestSchema
>

export const OpaquePayloadResponseSchema = Schema.Struct({
  data: Base64Schema,
  mediaType: NonEmptyString,
})
export type OpaquePayloadResponse = Schema.Schema.Type<
  typeof OpaquePayloadResponseSchema
>

const PersistJobPostingSnapshotBase = {
  fetcherVersion: NonEmptyString,
  finalUrl: Schema.NullOr(NonEmptyString),
  normalized: Schema.optional(Schema.NullOr(OpaquePayloadRequestSchema)),
  raw: Schema.optional(Schema.NullOr(OpaquePayloadRequestSchema)),
  requestedUrl: NonEmptyString,
}

export const PersistJobPostingSnapshotRequestSchema = Schema.Union([
  Schema.Struct({
    ...PersistJobPostingSnapshotBase,
    status: Schema.Literals(['fetched', 'provided']),
  }),
  Schema.Struct({
    ...PersistJobPostingSnapshotBase,
    errorCode: NonEmptyString,
    errorMessage: NonEmptyString,
    status: Schema.Literal('failed'),
  }),
])
export type PersistJobPostingSnapshotRequest = Schema.Schema.Type<
  typeof PersistJobPostingSnapshotRequestSchema
>

export const JobPostingSnapshotResponseSchema: Schema.Codec<JobPostingSnapshot> =
  Schema.revealCodec(JobPostingSnapshotSchema)

// Capture has no caller-supplied payload: the authenticated registry resolves
// the application's canonical URL and preserves the response as a snapshot.
export const CaptureJobPostingSnapshotResponseSchema =
  JobPostingSnapshotResponseSchema

export const JobPostingSnapshotParamsSchema = Schema.Struct({
  id: NonEmptyString,
  snapshotId: NonEmptyString,
})

export const JobPostingSnapshotPayloadParamsSchema = Schema.Struct({
  id: NonEmptyString,
  kind: Schema.Literals(['normalized', 'raw']),
  snapshotId: NonEmptyString,
})

export const EnsureContentEntryRequestSchema = Schema.Struct({
  kind: ContentEntryKindSchema,
  locale: RegistryContentLocaleSchema,
})
export type EnsureContentEntryRequest = Schema.Schema.Type<
  typeof EnsureContentEntryRequestSchema
>

export const ContentEntryResponseSchema: Schema.Codec<ContentEntry> =
  Schema.revealCodec(ContentEntrySchema)

export const ContentEntryParamsSchema = Schema.Struct({
  entryId: NonEmptyString,
  id: NonEmptyString,
})

export const ContentRevisionParamsSchema = Schema.Struct({
  entryId: NonEmptyString,
  id: NonEmptyString,
  revisionId: NonEmptyString,
})

export const AppendContentRevisionRequestSchema = Schema.Struct({
  contractId: NonEmptyString,
  contractVersion: NonEmptyString,
  expectedVersion: ExpectedApplicationVersionSchema,
  factsReleaseId: Schema.optional(Schema.NullOr(NonEmptyString)),
  jobSnapshotId: Schema.optional(Schema.NullOr(NonEmptyString)),
  operationId: NonEmptyString,
  payload: OpaquePayloadRequestSchema,
  source: ContentRevisionSourceSchema,
})
export type AppendContentRevisionRequest = Schema.Schema.Type<
  typeof AppendContentRevisionRequestSchema
>

export const ApproveContentRevisionRequestSchema = Schema.Struct({
  expectedVersion: ExpectedApplicationVersionSchema,
  revisionId: NonEmptyString,
})
export type ApproveContentRevisionRequest = Schema.Schema.Type<
  typeof ApproveContentRevisionRequestSchema
>

export type ContentRevisionResultResponse = {
  readonly entry: ContentEntry
  readonly revision: ContentRevision
}

export const ContentRevisionResultResponseSchema: Schema.Codec<ContentRevisionResultResponse> =
  Schema.revealCodec(
    Schema.Struct({
      entry: ContentEntrySchema,
      revision: ContentRevisionSchema,
    })
  )

export type ReadContentRevisionResponse = ContentRevisionResultResponse & {
  readonly payload: OpaquePayloadResponse
}

export const ReadContentRevisionResponseSchema: Schema.Codec<ReadContentRevisionResponse> =
  Schema.revealCodec(
    Schema.Struct({
      entry: ContentEntrySchema,
      payload: OpaquePayloadResponseSchema,
      revision: ContentRevisionSchema,
    })
  )

export const ListContentRevisionsResponseSchema: Schema.Codec<{
  readonly items: readonly ContentRevision[]
}> = Schema.revealCodec(
  Schema.Struct({
    items: Schema.Array(ContentRevisionSchema),
  })
)

export const PublishCvRequestSchema = Schema.Struct({
  expectedContentVersion: ExpectedApplicationVersionSchema,
  publicBaseUrl: NonEmptyString,
})
export type PublishCvRequest = Schema.Schema.Type<typeof PublishCvRequestSchema>

export const SetCvLinkAvailabilityRequestSchema = Schema.Struct({
  enabled: Schema.Boolean,
  expectedPublicationVersion: ExpectedApplicationVersionSchema,
  reason: Schema.optional(NonEmptyString),
})
export type SetCvLinkAvailabilityRequest = Schema.Schema.Type<
  typeof SetCvLinkAvailabilityRequestSchema
>

export const CvLinkResponseSchema: Schema.Codec<CvLink> =
  Schema.revealCodec(CvLinkSchema)

export const DisableApplicationCvLinksRequestSchema = Schema.Struct({
  reason: NonEmptyString,
})

export const DisableApplicationCvLinksResponseSchema = Schema.Struct({
  count: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
})

export const CurrentPdfArtifactParamsSchema = Schema.Struct({
  entryId: NonEmptyString,
  id: NonEmptyString,
})

export const CurrentPdfArtifactQuerySchema = Schema.Struct({
  rendererVersion: Schema.optional(NonEmptyString),
})

export const GeneratedArtifactResponseSchema: Schema.Codec<GeneratedArtifact> =
  Schema.revealCodec(GeneratedArtifactSchema)

export type ReadyPdfArtifactResponse = {
  readonly artifact: GeneratedArtifact
  readonly payload: OpaquePayloadResponse
}

export const ReadyPdfArtifactResponseSchema: Schema.Codec<ReadyPdfArtifactResponse> =
  Schema.revealCodec(
    Schema.Struct({
      artifact: GeneratedArtifactSchema,
      payload: OpaquePayloadResponseSchema,
    })
  )

export const PutOpaqueObjectRequestSchema = Schema.Struct({
  data: Base64Schema,
})

export const OpaqueObjectResponseSchema = Schema.Struct({
  byteLength: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  key: NonEmptyString,
  sha256: NonEmptyString,
})

export type RegisterFactsReleaseRequest = {
  readonly assets: readonly FactsReleaseAsset[]
  readonly catalogs: readonly FactsReleaseCatalog[]
  readonly release: FactsRelease
}

export const RegisterFactsReleaseRequestSchema: Schema.Codec<RegisterFactsReleaseRequest> =
  Schema.revealCodec(
    Schema.Struct({
      assets: Schema.Array(FactsReleaseAssetSchema),
      catalogs: Schema.Array(FactsReleaseCatalogSchema),
      release: FactsReleaseSchema,
    })
  )

export const FactsReleaseRecordResponseSchema =
  RegisterFactsReleaseRequestSchema

export const FactsReleaseParamsSchema = Schema.Struct({
  releaseId: NonEmptyString,
})

export const FactsChannelParamsSchema = Schema.Struct({
  channel: NonEmptyString,
})

export const ActivateFactsReleaseRequestSchema = Schema.Struct({
  expectedVersion: Schema.Int.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  releaseId: NonEmptyString,
})

export const ActiveFactsReleaseQuerySchema = Schema.Struct({
  channel: Schema.optional(NonEmptyString),
  locale: RegistryContentLocaleSchema,
})

export type ActiveFactsReleaseResponse = {
  readonly assets: readonly {
    readonly assetId: string
    readonly data: string
    readonly fileName: string
    readonly mediaType: string
    readonly sha256: string
  }[]
  readonly catalogue: {
    readonly data: string
    readonly locale: CvLocale
    readonly mediaType: string
    readonly sha256: string
  }
  readonly locales: readonly CvLocale[]
  readonly channel: FactsChannel
  readonly release: FactsRelease
}

export const ActiveFactsReleaseResponseSchema: Schema.Codec<ActiveFactsReleaseResponse> =
  Schema.revealCodec(
    Schema.Struct({
      assets: Schema.Array(
        Schema.Struct({
          assetId: NonEmptyString,
          data: Base64Schema,
          fileName: NonEmptyString,
          mediaType: NonEmptyString,
          sha256: NonEmptyString,
        })
      ),
      catalogue: Schema.Struct({
        data: Base64Schema,
        locale: RegistryContentLocaleSchema,
        mediaType: NonEmptyString,
        sha256: NonEmptyString,
      }),
      locales: Schema.Array(RegistryContentLocaleSchema).pipe(
        Schema.check(Schema.isMinLength(1))
      ),
      channel: FactsChannelSchema,
      release: FactsReleaseSchema,
    })
  )
