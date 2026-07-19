import type { AiModel } from '@cv/ai-provider'
import type {
  ActiveFactsReleaseResponse,
  ContentRevisionResultResponse,
  PdfJobResponse,
  ReadyPdfArtifactResponse,
  SetCvLinkAvailabilityRequest,
  StartPdfJobRequest,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ContentEntry,
  ContentRevisionSource,
  CvLink,
  GeneratedArtifact,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Schema } from 'effect'
import type * as Effect from 'effect/Effect'

import type {
  ContentHeadIdentity,
  PreparationContextIdentity,
  PreparationIdentity,
  PublicationIdentity,
} from './keys'

export type PreparationContext = {
  readonly factsCatalogue: FactsCatalogueV1
  readonly factsRelease: ActiveFactsReleaseResponse
  readonly factsReleaseId: string
  readonly jobContext: unknown
  readonly jobSnapshot: JobPostingSnapshot
  readonly locale: PreparationContextIdentity['locale']
}

export type SavedContentRevision = ContentRevisionResultResponse & {
  readonly value: unknown
}

export type PreparationBootstrap = {
  readonly application: Application
  readonly context: PreparationContext
  readonly entry: ContentEntry
  readonly head: SavedContentRevision | null
}

export type PublishedCvState = {
  readonly artifact: GeneratedArtifact
  readonly link: CvLink
}

export type ManualJobContextInput = {
  readonly applicationId: string
  readonly value: string
}

export type AppendRevisionInput = {
  readonly applicationId: string
  readonly contractId: string
  readonly contractVersion: string
  readonly entry: ContentEntry
  readonly factsReleaseId: string | null
  readonly jobSnapshotId: string | null
  readonly operationId?: string | undefined
  readonly source: ContentRevisionSource
  readonly value: unknown
}

export type ApproveRevisionInput = {
  readonly applicationId: string
  readonly entry: ContentEntry
  readonly revisionId: string
}

export type PublishCvInput = {
  readonly applicationId: string
  readonly entry: ContentEntry
  readonly publicBaseUrl: string
}

export type SetPublicationAvailabilityInput = {
  readonly applicationId: string
  readonly entryId: string
  readonly input: SetCvLinkAvailabilityRequest
}

export type StartPdfGenerationInput = {
  readonly applicationId: string
  readonly entryId: string
  readonly input: StartPdfJobRequest
}

export type ReadPdfJobInput = {
  readonly applicationId: string
  readonly entryId: string
  readonly jobId: string
}

export type ReadCurrentPdfInput = PublicationIdentity

export type PreparationRepositoryShape = {
  readonly appendRevision: (
    input: AppendRevisionInput
  ) => Effect.Effect<ContentRevisionResultResponse, PreparationDataError>
  readonly approveRevision: (
    input: ApproveRevisionInput
  ) => Effect.Effect<ContentRevisionResultResponse, PreparationDataError>
  readonly discoverModels: () => Effect.Effect<
    ReadonlyArray<AiModel>,
    PreparationDataError
  >
  readonly loadBootstrap: (
    identity: PreparationIdentity
  ) => Effect.Effect<PreparationBootstrap, PreparationDataError>
  readonly loadContentHead: (
    identity: ContentHeadIdentity
  ) => Effect.Effect<SavedContentRevision | null, PreparationDataError>
  readonly loadPreparationHead: (
    identity: PreparationIdentity
  ) => Effect.Effect<SavedContentRevision | null, PreparationDataError>
  readonly loadContext: (
    identity: PreparationContextIdentity
  ) => Effect.Effect<PreparationContext, PreparationDataError>
  readonly loadPublishedCvState: (
    identity: PublicationIdentity
  ) => Effect.Effect<PublishedCvState | null, PreparationDataError>
  readonly persistManualJobContext: (
    input: ManualJobContextInput
  ) => Effect.Effect<JobPostingSnapshot, PreparationDataError>
  readonly publishCv: (
    input: PublishCvInput
  ) => Effect.Effect<CvLink, PreparationDataError>
  readonly readCurrentPdf: (
    input: ReadCurrentPdfInput
  ) => Effect.Effect<ReadyPdfArtifactResponse, PreparationDataError>
  readonly readPdfJob: (
    input: ReadPdfJobInput
  ) => Effect.Effect<PdfJobResponse, PreparationDataError>
  readonly refreshSnapshot: (
    applicationId: string
  ) => Effect.Effect<JobPostingSnapshot, PreparationDataError>
  readonly setPublicationAvailability: (
    input: SetPublicationAvailabilityInput
  ) => Effect.Effect<CvLink, PreparationDataError>
  readonly startPdfGeneration: (
    input: StartPdfGenerationInput
  ) => Effect.Effect<PdfJobResponse, PreparationDataError>
}

export class PreparationDataError extends Schema.TaggedErrorClass<PreparationDataError>()(
  'PreparationDataError',
  {
    message: Schema.String,
    operation: Schema.String,
  }
) {}
