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
  type GeneratedArtifact,
  GeneratedArtifactSchema,
  HttpUrlSchema,
  type JobPostingSnapshot,
  JobPostingSnapshotSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
} from '@cv/application-registry-entity'
import { CvLocaleSchema } from '@cv/contracts/facts'
import { Schema } from 'effect'
import { HttpApiSchema } from 'effect/unstable/httpapi'

export const RegistryContentLocaleSchema = CvLocaleSchema

export const BinaryBodySchema = Schema.Uint8Array.pipe(
  HttpApiSchema.asUint8Array({ contentType: 'application/octet-stream' })
)

export const BlobReferenceInputSchema = Schema.Struct({
  mediaType: NonEmptyString,
  sha256: NonEmptyString,
})
export type BlobReferenceInput = Schema.Schema.Type<
  typeof BlobReferenceInputSchema
>

const PersistJobPostingSnapshotBase = {
  fetcherVersion: NonEmptyString,
  finalUrl: Schema.NullOr(HttpUrlSchema),
  normalized: Schema.optional(Schema.NullOr(BlobReferenceInputSchema)),
  raw: Schema.optional(Schema.NullOr(BlobReferenceInputSchema)),
  requestedUrl: HttpUrlSchema,
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

export const ContentEntryResponseSchema: Schema.Codec<ContentEntry> =
  Schema.revealCodec(ContentEntrySchema)

export const ContentEntryParamsSchema = Schema.Struct({
  entryId: NonEmptyString,
  id: NonEmptyString,
})

export const ContentEntryNaturalKeyParamsSchema = Schema.Struct({
  id: NonEmptyString,
  kind: ContentEntryKindSchema,
  locale: RegistryContentLocaleSchema,
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
  blob: BlobReferenceInputSchema,
  source: ContentRevisionSourceSchema,
})
export type AppendContentRevisionRequest = Schema.Schema.Type<
  typeof AppendContentRevisionRequestSchema
>

export const ApproveContentRevisionRequestSchema = Schema.Struct({
  approvedRevisionId: NonEmptyString,
  expectedVersion: ExpectedApplicationVersionSchema,
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

export const ListContentRevisionsResponseSchema: Schema.Codec<{
  readonly items: readonly ContentRevision[]
}> = Schema.revealCodec(
  Schema.Struct({
    items: Schema.Array(ContentRevisionSchema),
  })
)

export const StageCvRequestSchema = Schema.Struct({
  expectedContentVersion: ExpectedApplicationVersionSchema,
  revisionId: NonEmptyString,
})
export type StageCvRequest = Schema.Schema.Type<typeof StageCvRequestSchema>

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

export const CurrentPdfArtifactParamsSchema = Schema.Struct({
  entryId: NonEmptyString,
  id: NonEmptyString,
})

export const CurrentPdfArtifactQuerySchema = Schema.Struct({
  rendererVersion: Schema.optional(NonEmptyString),
})

export const GeneratedArtifactResponseSchema: Schema.Codec<GeneratedArtifact> =
  Schema.revealCodec(GeneratedArtifactSchema)

export const BlobParamsSchema = Schema.Struct({ sha256: NonEmptyString })

export const BlobMetadataResponseSchema = Schema.Struct({
  byteLength: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  sha256: NonEmptyString,
})

export type BlobMetadataResponse = Schema.Schema.Type<
  typeof BlobMetadataResponseSchema
>
