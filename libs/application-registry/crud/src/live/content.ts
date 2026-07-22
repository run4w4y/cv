import { Layer } from 'effect'

import type { RegistryDatabase } from '../internal/connection'
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
  findReadyArtifactForPublication,
  listContentRevisions,
  markArtifactFailed,
  markArtifactReady,
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

export const makeContentCrudLive = (database: RegistryDatabase) =>
  Layer.mergeAll(
    Layer.succeed(JobPostingSnapshotsCrud, {
      find: (id) => findJobPostingSnapshot(database, id),
      latest: (applicationId) =>
        findLatestJobPostingSnapshot(database, applicationId),
      persist: (snapshot) => persistJobPostingSnapshot(database, snapshot),
    }),
    Layer.succeed(ContentCrud, {
      approve: (entryId, revisionId, expectedVersion, updatedAt) =>
        approveContentRevision(
          database,
          entryId,
          revisionId,
          expectedVersion,
          updatedAt
        ),
      appendRevision: (revision, expectedEntryVersion, updatedAt) =>
        appendContentRevision(
          database,
          revision,
          expectedEntryVersion,
          updatedAt
        ),
      createEntry: (entry) => createContentEntry(database, entry),
      findEntry: (id) => findContentEntry(database, id),
      findEntryByApplication: (applicationId, kind, locale) =>
        findContentEntryByApplication(database, applicationId, kind, locale),
      findRevision: (id) => findContentRevision(database, id),
      listRevisions: (entryId) => listContentRevisions(database, entryId),
    }),
    Layer.succeed(CvLinksCrud, {
      disableForFailedArtifact: (
        id,
        expectedVersion,
        artifact,
        reason,
        disabledAt
      ) =>
        disableCvLinkForFailedArtifact(
          database,
          id,
          expectedVersion,
          artifact,
          reason,
          disabledAt
        ),
      disableForApplication: (applicationId, reason, disabledAt) =>
        disableCvLinksForApplication(
          database,
          applicationId,
          reason,
          disabledAt
        ),
      enableForApplication: (applicationId, disabledReason, updatedAt) =>
        enableCvLinksForApplication(
          database,
          applicationId,
          disabledReason,
          updatedAt
        ),
      findByEntry: (contentEntryId) =>
        findCvLinkByEntry(database, contentEntryId),
      findByApplication: (applicationId) =>
        findCvLinksByApplication(database, applicationId),
      findByToken: (token) => findCvLinkByToken(database, token),
      stage: (link, expectedContentVersion) =>
        stageCvLink(database, link, expectedContentVersion),
      setEnabled: (
        id,
        expectedVersion,
        expectedPublicationVersion,
        enabled,
        reason,
        updatedAt
      ) =>
        setCvLinkEnabled(
          database,
          id,
          expectedVersion,
          expectedPublicationVersion,
          enabled,
          reason,
          updatedAt
        ),
    }),
    Layer.succeed(ArtifactsCrud, {
      find: (id) => findArtifact(database, id),
      findByRequestId: (requestId) =>
        findArtifactByRequestId(database, requestId),
      findCurrentForPublication: (
        cvLinkId,
        contentRevisionId,
        rendererVersion,
        publicationVersion,
        qrTarget
      ) =>
        findCurrentArtifactForPublication(
          database,
          cvLinkId,
          contentRevisionId,
          rendererVersion,
          publicationVersion,
          qrTarget
        ),
      findReadyForPublication: (
        cvLinkId,
        contentRevisionId,
        rendererVersion,
        publicationVersion,
        qrTarget
      ) =>
        findReadyArtifactForPublication(
          database,
          cvLinkId,
          contentRevisionId,
          rendererVersion,
          publicationVersion,
          qrTarget
        ),
      markFailed: (id, errorCode, errorMessage, updatedAt) =>
        markArtifactFailed(database, id, errorCode, errorMessage, updatedAt),
      markReady: (artifact) => markArtifactReady(database, artifact),
      persistPending: (artifact, expectedLinkVersion) =>
        persistPendingArtifact(database, artifact, expectedLinkVersion),
    })
  )
