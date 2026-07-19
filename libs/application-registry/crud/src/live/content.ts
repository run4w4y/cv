import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'

import { withRegistryConnections } from '../internal/connection'
import {
  activateFactsRelease,
  appendContentRevision,
  approveContentRevision,
  createContentEntry,
  disableCvLinksForApplication,
  enableCvLinksForApplication,
  findActiveFactsCatalog,
  findArtifact,
  findArtifactByRequestId,
  findPendingPdfDispatch,
  findContentEntry,
  findContentEntryByApplication,
  findContentRevision,
  findCvLinkByEntry,
  findCvLinkByToken,
  findFactsRelease,
  findJobPostingSnapshot,
  findLatestJobPostingSnapshot,
  findReadyArtifactForPublication,
  listContentRevisions,
  listFactsReleaseAssets,
  listFactsReleaseCatalogs,
  markArtifactFailed,
  markArtifactReady,
  markPdfDispatchFailed,
  markPdfDispatched,
  listPendingPdfDispatches,
  persistJobPostingSnapshot,
  persistPendingArtifact,
  publishCvLink,
  registerFactsRelease,
  setCvLinkEnabled,
} from '../persistence/content'
import {
  ArtifactsCrud,
  ContentCrud,
  CvLinksCrud,
  FactsReleasesCrud,
  JobPostingSnapshotsCrud,
} from '../services/content'

export const makeContentCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.mergeAll(
    Layer.succeed(JobPostingSnapshotsCrud, {
      find: (id) =>
        withRegistryConnections(database, ({ query }) =>
          findJobPostingSnapshot(query, id)
        ),
      latest: (applicationId) =>
        withRegistryConnections(database, ({ query }) =>
          findLatestJobPostingSnapshot(query, applicationId)
        ),
      persist: (snapshot) =>
        withRegistryConnections(database, ({ query }) =>
          persistJobPostingSnapshot(query, snapshot)
        ),
    }),
    Layer.succeed(FactsReleasesCrud, {
      activate: (channel, releaseId, expectedVersion, updatedAt) =>
        withRegistryConnections(database, ({ query }) =>
          activateFactsRelease(
            query,
            channel,
            releaseId,
            expectedVersion,
            updatedAt
          )
        ),
      assets: (releaseId) =>
        withRegistryConnections(database, ({ query }) =>
          listFactsReleaseAssets(query, releaseId)
        ),
      catalogs: (releaseId) =>
        withRegistryConnections(database, ({ query }) =>
          listFactsReleaseCatalogs(query, releaseId)
        ),
      find: (releaseId) =>
        withRegistryConnections(database, ({ query }) =>
          findFactsRelease(query, releaseId)
        ),
      findActiveCatalog: (channel, locale) =>
        withRegistryConnections(database, ({ query }) =>
          findActiveFactsCatalog(query, channel, locale)
        ),
      register: (release) =>
        withRegistryConnections(database, (connections) =>
          registerFactsRelease(connections, release)
        ),
    }),
    Layer.succeed(ContentCrud, {
      approve: (entryId, revisionId, expectedVersion, updatedAt) =>
        withRegistryConnections(database, ({ query }) =>
          approveContentRevision(
            query,
            entryId,
            revisionId,
            expectedVersion,
            updatedAt
          )
        ),
      appendRevision: (revision, expectedEntryVersion, updatedAt) =>
        withRegistryConnections(database, (connections) =>
          appendContentRevision(
            connections,
            revision,
            expectedEntryVersion,
            updatedAt
          )
        ),
      createEntry: (entry) =>
        withRegistryConnections(database, ({ query }) =>
          createContentEntry(query, entry)
        ),
      findEntry: (id) =>
        withRegistryConnections(database, ({ query }) =>
          findContentEntry(query, id)
        ),
      findEntryByApplication: (applicationId, kind, locale) =>
        withRegistryConnections(database, ({ query }) =>
          findContentEntryByApplication(query, applicationId, kind, locale)
        ),
      findRevision: (id) =>
        withRegistryConnections(database, ({ query }) =>
          findContentRevision(query, id)
        ),
      listRevisions: (entryId) =>
        withRegistryConnections(database, ({ query }) =>
          listContentRevisions(query, entryId)
        ),
    }),
    Layer.succeed(CvLinksCrud, {
      disableForApplication: (applicationId, reason, disabledAt) =>
        withRegistryConnections(database, ({ query }) =>
          disableCvLinksForApplication(query, applicationId, reason, disabledAt)
        ),
      enableForApplication: (applicationId, disabledReason, updatedAt) =>
        withRegistryConnections(database, ({ query }) =>
          enableCvLinksForApplication(
            query,
            applicationId,
            disabledReason,
            updatedAt
          )
        ),
      findByEntry: (contentEntryId) =>
        withRegistryConnections(database, ({ query }) =>
          findCvLinkByEntry(query, contentEntryId)
        ),
      findByToken: (token) =>
        withRegistryConnections(database, ({ query }) =>
          findCvLinkByToken(query, token)
        ),
      publish: (link) =>
        withRegistryConnections(database, ({ query }) =>
          publishCvLink(query, link)
        ),
      setEnabled: (
        id,
        expectedVersion,
        expectedPublicationVersion,
        enabled,
        reason,
        updatedAt
      ) =>
        withRegistryConnections(database, ({ query }) =>
          setCvLinkEnabled(
            query,
            id,
            expectedVersion,
            expectedPublicationVersion,
            enabled,
            reason,
            updatedAt
          )
        ),
    }),
    Layer.succeed(ArtifactsCrud, {
      find: (id) =>
        withRegistryConnections(database, ({ query }) =>
          findArtifact(query, id)
        ),
      findByRequestId: (requestId) =>
        withRegistryConnections(database, ({ query }) =>
          findArtifactByRequestId(query, requestId)
        ),
      findPendingDispatch: (artifactId) =>
        withRegistryConnections(database, ({ query }) =>
          findPendingPdfDispatch(query, artifactId)
        ),
      findReadyForPublication: (
        cvLinkId,
        contentRevisionId,
        rendererVersion,
        publicationVersion,
        qrTarget
      ) =>
        withRegistryConnections(database, ({ query }) =>
          findReadyArtifactForPublication(
            query,
            cvLinkId,
            contentRevisionId,
            rendererVersion,
            publicationVersion,
            qrTarget
          )
        ),
      markFailed: (id, errorCode, errorMessage, updatedAt) =>
        withRegistryConnections(database, ({ query }) =>
          markArtifactFailed(query, id, errorCode, errorMessage, updatedAt)
        ),
      markDispatchFailed: (artifactId, message, attemptedAt) =>
        withRegistryConnections(database, ({ query }) =>
          markPdfDispatchFailed(query, artifactId, message, attemptedAt)
        ),
      markDispatched: (artifactId, dispatchedAt) =>
        withRegistryConnections(database, ({ query }) =>
          markPdfDispatched(query, artifactId, dispatchedAt)
        ),
      markReady: (artifact) =>
        withRegistryConnections(database, ({ query }) =>
          markArtifactReady(query, artifact)
        ),
      persistPending: (artifact, outbox) =>
        withRegistryConnections(database, (connections) =>
          persistPendingArtifact(connections, artifact, outbox)
        ),
      pendingDispatches: (limit) =>
        withRegistryConnections(database, ({ query }) =>
          listPendingPdfDispatches(query, limit)
        ),
    })
  )
