import type { AiModel } from '@cv/ai-provider'
import type {
  ContentRevisionResultResponse,
  PdfJobResponse,
  SetCvLinkAvailabilityRequest,
  StartPdfJobRequest,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ContentEntry,
  ContentRevision,
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
  readonly factsRelease: {
    readonly id: string
    readonly locales: ReadonlyArray<string>
    readonly provenance: {
      readonly compiler: {
        readonly commit: string
        readonly repository: string
      }
      readonly source: { readonly commit: string; readonly repository: string }
    }
  }
  readonly factsReleaseId: string
  readonly jobContext: Schema.Json
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

export type WorkflowBootstrapInput = {
  readonly application: Application
  readonly kind: ContentEntry['kind']
  readonly locale: PreparationContextIdentity['locale']
  readonly snapshotId: string | null
}

export type WorkflowBootstrap = {
  readonly context: PreparationContext
  readonly entry: ContentEntry
}

export type PreparationApplicationDetailsInput = {
  readonly application: Application
  readonly company: string | null
  readonly location: string | null
  readonly operationId: string
  readonly role: string
}

export type ContentRevisionHistoryInput = {
  readonly applicationId: string
  readonly entryId: string
}

export type ContentRevisionHistory = {
  readonly entry: ContentEntry
  readonly revisions: ReadonlyArray<ContentRevision>
}

export type CvPageState = {
  readonly artifact: GeneratedArtifact | null
  readonly link: CvLink
}

export type ReadyPdfArtifact = {
  readonly artifact: GeneratedArtifact
  readonly bytes: Uint8Array
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

export type StageCvInput = {
  readonly applicationId: string
  readonly entry: ContentEntry
  readonly publicBaseUrl: string
  readonly revisionId: string
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
  readonly createPreparationApplication: (
    postingUrl: string
  ) => Effect.Effect<Application, PreparationDataError>
  readonly loadBootstrap: (
    identity: PreparationIdentity
  ) => Effect.Effect<PreparationBootstrap, PreparationDataError>
  readonly loadContentHead: (
    identity: ContentHeadIdentity
  ) => Effect.Effect<SavedContentRevision | null, PreparationDataError>
  readonly loadContentEntry: (
    input: ContentRevisionHistoryInput
  ) => Effect.Effect<ContentEntry, PreparationDataError>
  readonly loadContentRevisionHistory: (
    input: ContentRevisionHistoryInput
  ) => Effect.Effect<ContentRevisionHistory, PreparationDataError>
  readonly loadPreparationHead: (
    identity: PreparationIdentity
  ) => Effect.Effect<SavedContentRevision | null, PreparationDataError>
  readonly loadContext: (
    identity: PreparationContextIdentity
  ) => Effect.Effect<PreparationContext, PreparationDataError>
  readonly loadCvPageState: (
    identity: PublicationIdentity
  ) => Effect.Effect<CvPageState | null, PreparationDataError>
  readonly loadWorkflowBootstrap: (
    input: WorkflowBootstrapInput
  ) => Effect.Effect<WorkflowBootstrap, PreparationDataError>
  readonly persistManualJobContext: (
    input: ManualJobContextInput
  ) => Effect.Effect<JobPostingSnapshot, PreparationDataError>
  readonly stageCv: (
    input: StageCvInput
  ) => Effect.Effect<CvLink, PreparationDataError>
  readonly readCurrentPdf: (
    input: ReadCurrentPdfInput
  ) => Effect.Effect<ReadyPdfArtifact, PreparationDataError>
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
  readonly startPreparation: (
    applicationId: string
  ) => Effect.Effect<Application, PreparationDataError>
  readonly updatePreparationApplication: (
    input: PreparationApplicationDetailsInput
  ) => Effect.Effect<Application, PreparationDataError>
}

export class PreparationDataError extends Schema.TaggedErrorClass<PreparationDataError>()(
  'PreparationDataError',
  {
    message: Schema.String,
    operation: Schema.String,
  }
) {}
