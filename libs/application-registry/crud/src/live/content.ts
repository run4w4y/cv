import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'

import { withRegistryConnections } from '../internal/connection'
import {
  appendContentRevision,
  approveContentRevision,
  createContentEntry,
  disableCvLinkForFailedArtifact,
  disableCvLinksForApplication,
  enableCvLinksForApplication,
  findArtifact,
  findArtifactByRequestId,
  findContentEntry,
  findContentEntryByApplication,
  findContentRevision,
  findCurrentArtifactForPublication,
  findCvLinkByEntry,
  findCvLinkByToken,
  findCvLinksByApplication,
  findJobPostingSnapshot,
  findLatestJobPostingSnapshot,
  findPendingPdfDispatch,
  findReadyArtifactForPublication,
  listContentRevisions,
  listPendingPdfDispatches,
  markArtifactFailed,
  markArtifactReady,
  markPdfDispatched,
  markPdfDispatchFailed,
  persistJobPostingSnapshot,
  persistPendingArtifact,
  setCvLinkEnabled,
  stageCvLink,
} from '../persistence/content'
import {
  ArtifactsCrud,
  ContentCrud,
  CvLinksCrud,
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
      disableForFailedArtifact: (
        id,
        expectedVersion,
        artifact,
        reason,
        disabledAt
      ) =>
        withRegistryConnections(database, ({ query }) =>
          disableCvLinkForFailedArtifact(
            query,
            id,
            expectedVersion,
            artifact,
            reason,
            disabledAt
          )
        ),
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
      findByApplication: (applicationId) =>
        withRegistryConnections(database, ({ query }) =>
          findCvLinksByApplication(query, applicationId)
        ),
      findByToken: (token) =>
        withRegistryConnections(database, ({ query }) =>
          findCvLinkByToken(query, token)
        ),
      stage: (link) =>
        withRegistryConnections(database, ({ query }) =>
          stageCvLink(query, link)
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
      findCurrentForPublication: (
        cvLinkId,
        contentRevisionId,
        rendererVersion,
        publicationVersion,
        qrTarget
      ) =>
        withRegistryConnections(database, ({ query }) =>
          findCurrentArtifactForPublication(
            query,
            cvLinkId,
            contentRevisionId,
            rendererVersion,
            publicationVersion,
            qrTarget
          )
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
      persistPending: (artifact, outbox, expectedLinkVersion) =>
        withRegistryConnections(database, (connections) =>
          persistPendingArtifact(
            connections,
            artifact,
            outbox,
            expectedLinkVersion
          )
        ),
      pendingDispatches: (limit) =>
        withRegistryConnections(database, ({ query }) =>
          listPendingPdfDispatches(query, limit)
        ),
    })
  )
