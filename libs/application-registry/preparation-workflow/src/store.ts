import type {
  Application,
  ContentEntry,
  ContentRevision,
  ContentRevisionSource,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Context, Schema } from 'effect'
import type * as Effect from 'effect/Effect'

import type { ContentRevisionResult } from './domain'

export type PreparationStoreContext = {
  readonly factsCatalogue: FactsCatalogueV1
  readonly factsReleaseId: string
  readonly jobContext: Schema.Json
  readonly jobSnapshot: JobPostingSnapshot
}

export type LoadPreparationBootstrapInput = {
  readonly application: Application
  readonly kind: ContentEntry['kind']
  readonly locale: string
  readonly snapshotId: string | null
}

export type PreparationStoreBootstrap = {
  readonly context: PreparationStoreContext
  readonly entry: ContentEntry
}

export type UpdatePreparationApplicationInput = {
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

export type AppendCandidateRevisionInput = {
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

export type ApproveCandidateRevisionInput = {
  readonly applicationId: string
  readonly entry: ContentEntry
  readonly revisionId: string
}

export class PreparationStoreError extends Schema.TaggedErrorClass<PreparationStoreError>()(
  'PreparationStoreError',
  {
    message: Schema.String,
    operation: Schema.String,
  }
) {}

export type PreparationStoreShape = {
  readonly appendRevision: (
    input: AppendCandidateRevisionInput
  ) => Effect.Effect<ContentRevisionResult, PreparationStoreError>
  readonly approveRevision: (
    input: ApproveCandidateRevisionInput
  ) => Effect.Effect<ContentRevisionResult, PreparationStoreError>
  readonly createPreparationApplication: (
    postingUrl: string
  ) => Effect.Effect<Application, PreparationStoreError>
  readonly loadContentEntry: (
    input: ContentRevisionHistoryInput
  ) => Effect.Effect<ContentEntry, PreparationStoreError>
  readonly loadContentRevisionHistory: (
    input: ContentRevisionHistoryInput
  ) => Effect.Effect<ContentRevisionHistory, PreparationStoreError>
  readonly loadWorkflowBootstrap: (
    input: LoadPreparationBootstrapInput
  ) => Effect.Effect<PreparationStoreBootstrap, PreparationStoreError>
  readonly startPreparation: (
    applicationId: string
  ) => Effect.Effect<Application, PreparationStoreError>
  readonly updatePreparationApplication: (
    input: UpdatePreparationApplicationInput
  ) => Effect.Effect<Application, PreparationStoreError>
}

export class PreparationStore extends Context.Service<
  PreparationStore,
  PreparationStoreShape
>()('@cv/application-preparation-workflow/PreparationStore') {}
