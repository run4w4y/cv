import type {
  ContentEntry,
  ContentRevision,
  CvLink,
  FactsChannel,
  FactsRelease,
  FactsReleaseAsset,
  FactsReleaseCatalog,
  GeneratedArtifact,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type {
  PersistedContentEntry,
  PersistedContentRevision,
  PersistedCvLink,
  PersistedFactsRelease,
  PersistedGeneratedArtifact,
  PersistedJobPostingSnapshot,
} from '../types'

export interface JobPostingSnapshotsCrud {
  readonly find: (
    id: string
  ) => Effect.Effect<JobPostingSnapshot | undefined, RegistryDatabaseError>
  readonly latest: (
    applicationId: string
  ) => Effect.Effect<JobPostingSnapshot | undefined, RegistryDatabaseError>
  readonly persist: (
    snapshot: PersistedJobPostingSnapshot
  ) => Effect.Effect<void, RegistryDatabaseError>
}
export const JobPostingSnapshotsCrud = Context.Service<JobPostingSnapshotsCrud>(
  '@cv/application-registry-crud/JobPostingSnapshotsCrud'
)

export type ActiveFactsCatalog = {
  readonly channel: FactsChannel
  readonly release: FactsRelease
  readonly catalog: FactsReleaseCatalog
}

export interface FactsReleasesCrud {
  readonly activate: (
    channel: string,
    releaseId: string,
    expectedVersion: number,
    updatedAt: string
  ) => Effect.Effect<boolean, RegistryDatabaseError>
  readonly assets: (
    releaseId: string
  ) => Effect.Effect<readonly FactsReleaseAsset[], RegistryDatabaseError>
  readonly catalogs: (
    releaseId: string
  ) => Effect.Effect<readonly FactsReleaseCatalog[], RegistryDatabaseError>
  readonly find: (
    releaseId: string
  ) => Effect.Effect<FactsRelease | undefined, RegistryDatabaseError>
  readonly findActiveCatalog: (
    channel: string,
    locale: string
  ) => Effect.Effect<ActiveFactsCatalog | undefined, RegistryDatabaseError>
  readonly register: (
    release: PersistedFactsRelease
  ) => Effect.Effect<void, RegistryDatabaseError>
}
export const FactsReleasesCrud = Context.Service<FactsReleasesCrud>(
  '@cv/application-registry-crud/FactsReleasesCrud'
)

export interface ContentCrud {
  readonly approve: (
    entryId: string,
    revisionId: string,
    expectedVersion: number,
    updatedAt: string
  ) => Effect.Effect<boolean, RegistryDatabaseError>
  readonly appendRevision: (
    revision: PersistedContentRevision,
    expectedEntryVersion: number,
    updatedAt: string
  ) => Effect.Effect<boolean, RegistryDatabaseError>
  readonly createEntry: (
    entry: PersistedContentEntry
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly findEntry: (
    id: string
  ) => Effect.Effect<ContentEntry | undefined, RegistryDatabaseError>
  readonly findEntryByApplication: (
    applicationId: string,
    kind: ContentEntry['kind'],
    locale: string
  ) => Effect.Effect<ContentEntry | undefined, RegistryDatabaseError>
  readonly findRevision: (
    id: string
  ) => Effect.Effect<ContentRevision | undefined, RegistryDatabaseError>
  readonly listRevisions: (
    entryId: string
  ) => Effect.Effect<readonly ContentRevision[], RegistryDatabaseError>
}
export const ContentCrud = Context.Service<ContentCrud>(
  '@cv/application-registry-crud/ContentCrud'
)

export interface CvLinksCrud {
  readonly disableForApplication: (
    applicationId: string,
    reason: string,
    disabledAt: string
  ) => Effect.Effect<number, RegistryDatabaseError>
  readonly enableForApplication: (
    applicationId: string,
    disabledReason: string,
    updatedAt: string
  ) => Effect.Effect<number, RegistryDatabaseError>
  readonly findByEntry: (
    contentEntryId: string
  ) => Effect.Effect<CvLink | undefined, RegistryDatabaseError>
  readonly findByToken: (
    token: string
  ) => Effect.Effect<CvLink | undefined, RegistryDatabaseError>
  readonly publish: (
    link: PersistedCvLink
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly setEnabled: (
    id: string,
    expectedVersion: number,
    expectedPublicationVersion: number,
    enabled: boolean,
    reason: string | null,
    updatedAt: string
  ) => Effect.Effect<boolean, RegistryDatabaseError>
}
export const CvLinksCrud = Context.Service<CvLinksCrud>(
  '@cv/application-registry-crud/CvLinksCrud'
)

export interface ArtifactsCrud {
  readonly find: (
    id: string
  ) => Effect.Effect<GeneratedArtifact | undefined, RegistryDatabaseError>
  readonly findByWorkflowId: (
    workflowId: string
  ) => Effect.Effect<GeneratedArtifact | undefined, RegistryDatabaseError>
  readonly findReadyForPublication: (
    cvLinkId: string,
    contentRevisionId: string,
    rendererVersion: string | null,
    publicationVersion: number,
    qrTarget: string
  ) => Effect.Effect<GeneratedArtifact | undefined, RegistryDatabaseError>
  readonly markFailed: (
    id: string,
    errorCode: string,
    errorMessage: string,
    updatedAt: string
  ) => Effect.Effect<boolean, RegistryDatabaseError>
  readonly markReady: (
    artifact: PersistedGeneratedArtifact
  ) => Effect.Effect<boolean, RegistryDatabaseError>
  readonly persistPending: (
    artifact: PersistedGeneratedArtifact
  ) => Effect.Effect<void, RegistryDatabaseError>
}
export const ArtifactsCrud = Context.Service<ArtifactsCrud>(
  '@cv/application-registry-crud/ArtifactsCrud'
)
