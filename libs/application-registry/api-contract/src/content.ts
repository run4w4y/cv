import {
  ContentEntryKindSchema,
  ContentEntrySchema,
  ContentRevisionSchema,
  ContentRevisionSourceSchema,
  CvLinkSchema,
  ExpectedApplicationVersionSchema,
  FactsChannelSchema,
  FactsReleaseAssetSchema,
  FactsReleaseCatalogSchema,
  FactsReleaseSchema,
  GeneratedArtifactSchema,
  JobPostingSnapshotSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

export const RegistryContentLocaleSchema = Schema.Literal('en')

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

export const JobPostingSnapshotResponseSchema = JobPostingSnapshotSchema

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

export const ContentEntryResponseSchema = ContentEntrySchema

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

export const ContentRevisionResultResponseSchema = Schema.Struct({
  entry: ContentEntrySchema,
  revision: ContentRevisionSchema,
})

export const ReadContentRevisionResponseSchema = Schema.Struct({
  entry: ContentEntrySchema,
  payload: OpaquePayloadResponseSchema,
  revision: ContentRevisionSchema,
})

export const ListContentRevisionsResponseSchema = Schema.Struct({
  items: Schema.Array(ContentRevisionSchema),
})

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

export const CvLinkResponseSchema = CvLinkSchema

export const DisableApplicationCvLinksRequestSchema = Schema.Struct({
  reason: NonEmptyString,
})

export const DisableApplicationCvLinksResponseSchema = Schema.Struct({
  count: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
})

export const BeginPdfArtifactRequestSchema = Schema.Struct({
  expectedPublicationVersion: ExpectedApplicationVersionSchema,
  rendererVersion: NonEmptyString,
  workflowId: NonEmptyString,
})
export type BeginPdfArtifactRequest = Schema.Schema.Type<
  typeof BeginPdfArtifactRequestSchema
>

export const PdfArtifactParamsSchema = Schema.Struct({
  artifactId: NonEmptyString,
  id: NonEmptyString,
})

export const CurrentPdfArtifactParamsSchema = Schema.Struct({
  entryId: NonEmptyString,
  id: NonEmptyString,
})

export const CurrentPdfArtifactQuerySchema = Schema.Struct({
  rendererVersion: Schema.optional(NonEmptyString),
})

export const CompletePdfArtifactRequestSchema = Schema.Struct({
  data: Base64Schema,
})

export const FailPdfArtifactRequestSchema = Schema.Struct({
  errorCode: NonEmptyString,
  errorMessage: NonEmptyString,
})

export const GeneratedArtifactResponseSchema = GeneratedArtifactSchema

export const ReadyPdfArtifactResponseSchema = Schema.Struct({
  artifact: GeneratedArtifactSchema,
  payload: OpaquePayloadResponseSchema,
})

export const PdfWorkflowStatusSchema = Schema.Literals([
  'queued',
  'running',
  'paused',
  'errored',
  'terminated',
  'complete',
  'waiting',
  'waitingForPause',
  'unknown',
])

export const StartPdfWorkflowRequestSchema = Schema.Struct({
  expectedPublicationVersion: ExpectedApplicationVersionSchema,
  rendererVersion: NonEmptyString,
})
export type StartPdfWorkflowRequest = Schema.Schema.Type<
  typeof StartPdfWorkflowRequestSchema
>

export const PdfWorkflowParamsSchema = Schema.Struct({
  entryId: NonEmptyString,
  id: NonEmptyString,
  workflowId: NonEmptyString,
})

export const PdfWorkflowResponseSchema = Schema.Struct({
  artifactId: Schema.NullOr(NonEmptyString),
  errorMessage: Schema.NullOr(NonEmptyString),
  status: PdfWorkflowStatusSchema,
  workflowId: NonEmptyString,
})
export type PdfWorkflowResponse = Schema.Schema.Type<
  typeof PdfWorkflowResponseSchema
>

export const PutOpaqueObjectRequestSchema = Schema.Struct({
  data: Base64Schema,
})

export const OpaqueObjectResponseSchema = Schema.Struct({
  byteLength: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  key: NonEmptyString,
  sha256: NonEmptyString,
})

export const RegisterFactsReleaseRequestSchema = Schema.Struct({
  assets: Schema.Array(FactsReleaseAssetSchema),
  catalogs: Schema.Array(FactsReleaseCatalogSchema),
  release: FactsReleaseSchema,
})

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

export const ActiveFactsReleaseResponseSchema = Schema.Struct({
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
  channel: FactsChannelSchema,
  release: FactsReleaseSchema,
})
