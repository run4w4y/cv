import {
  contentEntries,
  contentRevisions,
  cvLinks,
  generatedArtifacts,
  jobPostingSnapshots,
  pdfGenerationOutbox,
} from '@cv/application-registry-entity'
import { and, asc, desc, eq, exists, gt, notExists, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'

import { databaseFailure } from '../errors'
import type {
  RegistryConnections,
  RegistryQueryDatabase,
} from '../internal/connection'
import type {
  PersistedContentEntry,
  PersistedContentRevision,
  PersistedCvLink,
  PersistedGeneratedArtifact,
  PersistedJobPostingSnapshot,
  PersistedPdfGenerationOutbox,
} from '../types'
import { runBatch } from './shared'

const first = <A>(rows: readonly A[]) => rows.at(0)

export const findJobPostingSnapshot = (
  database: RegistryQueryDatabase,
  id: string
) =>
  database
    .select()
    .from(jobPostingSnapshots)
    .where(eq(jobPostingSnapshots.id, id))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load job posting snapshot'))
    )

export const findLatestJobPostingSnapshot = (
  database: RegistryQueryDatabase,
  applicationId: string
) =>
  database
    .select()
    .from(jobPostingSnapshots)
    .where(eq(jobPostingSnapshots.applicationId, applicationId))
    .orderBy(desc(jobPostingSnapshots.fetchedAt), desc(jobPostingSnapshots.id))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(
        databaseFailure('Failed to load latest job posting snapshot')
      )
    )

export const persistJobPostingSnapshot = (
  database: RegistryQueryDatabase,
  snapshot: PersistedJobPostingSnapshot
) =>
  database
    .insert(jobPostingSnapshots)
    .values(snapshot)
    .onConflictDoNothing({ target: jobPostingSnapshots.id })
    .pipe(
      Effect.asVoid,
      Effect.mapError(databaseFailure('Failed to persist job posting snapshot'))
    )

export const createContentEntry = (
  database: RegistryQueryDatabase,
  entry: PersistedContentEntry
) =>
  database
    .insert(contentEntries)
    .values({
      ...entry,
      approvedRevisionId: null,
      headRevisionId: null,
      state: 'draft',
      version: 1,
    })
    .onConflictDoNothing({
      target: [
        contentEntries.applicationId,
        contentEntries.kind,
        contentEntries.locale,
      ],
    })
    .pipe(
      Effect.asVoid,
      Effect.mapError(databaseFailure('Failed to create content entry'))
    )

export const findContentEntry = (database: RegistryQueryDatabase, id: string) =>
  database
    .select()
    .from(contentEntries)
    .where(eq(contentEntries.id, id))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load content entry'))
    )

export const findContentEntryByApplication = (
  database: RegistryQueryDatabase,
  applicationId: string,
  kind: (typeof contentEntries.$inferSelect)['kind'],
  locale: string
) =>
  database
    .select()
    .from(contentEntries)
    .where(
      and(
        eq(contentEntries.applicationId, applicationId),
        eq(contentEntries.kind, kind),
        eq(contentEntries.locale, locale)
      )
    )
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load application content'))
    )

export const findContentRevision = (
  database: RegistryQueryDatabase,
  id: string
) =>
  database
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.id, id))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load content revision'))
    )

export const listContentRevisions = (
  database: RegistryQueryDatabase,
  entryId: string
) =>
  database
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.contentEntryId, entryId))
    .orderBy(asc(contentRevisions.revisionNumber))
    .pipe(Effect.mapError(databaseFailure('Failed to list content revisions')))

const nullableEquals = (
  column: typeof contentEntries.headRevisionId,
  value: string | null
) => (value === null ? sql`${column} is null` : eq(column, value))

export const appendContentRevision = (
  database: RegistryConnections,
  revision: PersistedContentRevision,
  expectedEntryVersion: number,
  updatedAt: string
) => {
  const eligibleEntry = and(
    eq(contentEntries.id, revision.contentEntryId),
    eq(contentEntries.version, expectedEntryVersion),
    nullableEquals(contentEntries.headRevisionId, revision.parentRevisionId)
  )
  const revisionInsert = database.batch.insert(contentRevisions).select(
    database.batch
      .select({
        id: sql<string>`${revision.id}`.as('id'),
        contentEntryId: contentEntries.id,
        revisionNumber: sql<number>`${revision.revisionNumber}`.as(
          'revision_number'
        ),
        parentRevisionId: sql<string | null>`${revision.parentRevisionId}`.as(
          'parent_revision_id'
        ),
        contractId: sql<string>`${revision.contractId}`.as('contract_id'),
        contractVersion: sql<string>`${revision.contractVersion}`.as(
          'contract_version'
        ),
        objectKey: sql<string>`${revision.objectKey}`.as('object_key'),
        sha256: sql<string>`${revision.sha256}`.as('sha256'),
        byteLength: sql<number>`${revision.byteLength}`.as('byte_length'),
        mediaType: sql<string>`${revision.mediaType}`.as('media_type'),
        source: sql`${revision.source}`.as('source'),
        factsReleaseId: sql<string | null>`${revision.factsReleaseId}`.as(
          'facts_release_id'
        ),
        jobSnapshotId: sql<string | null>`${revision.jobSnapshotId}`.as(
          'job_snapshot_id'
        ),
        operationId: sql<string>`${revision.operationId}`.as('operation_id'),
        createdAt: sql<string>`${revision.createdAt}`.as('created_at'),
      })
      .from(contentEntries)
      .where(eligibleEntry)
  )
  const revisionExists = exists(
    database.batch
      .select({ id: contentRevisions.id })
      .from(contentRevisions)
      .where(eq(contentRevisions.id, revision.id))
  )
  const statements = [
    revisionInsert,
    database.batch
      .update(contentEntries)
      .set({
        headRevisionId: revision.id,
        state: 'draft',
        updatedAt,
        version: sql`${contentEntries.version} + 1`,
      })
      .where(and(eligibleEntry, revisionExists)),
  ] satisfies [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(database.batch, 'content revision append', statements).pipe(
    Effect.map((results) => (results.at(-1)?.meta.changes ?? 0) > 0)
  )
}

export const approveContentRevision = (
  database: RegistryQueryDatabase,
  entryId: string,
  revisionId: string,
  expectedVersion: number,
  updatedAt: string
) =>
  database
    .update(contentEntries)
    .set({
      approvedRevisionId: revisionId,
      state: 'approved',
      updatedAt,
      version: sql`${contentEntries.version} + 1`,
    })
    .where(
      and(
        eq(contentEntries.id, entryId),
        eq(contentEntries.version, expectedVersion),
        exists(
          database
            .select({ id: contentRevisions.id })
            .from(contentRevisions)
            .where(
              and(
                eq(contentRevisions.id, revisionId),
                eq(contentRevisions.contentEntryId, entryId)
              )
            )
        )
      )
    )
    .returning({ id: contentEntries.id })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to approve content revision'))
    )

export const findCvLinkByToken = (
  database: RegistryQueryDatabase,
  token: string
) =>
  database
    .select()
    .from(cvLinks)
    .where(eq(cvLinks.token, token))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load public CV link'))
    )

export const findCvLinkByEntry = (
  database: RegistryQueryDatabase,
  contentEntryId: string
) =>
  database
    .select()
    .from(cvLinks)
    .where(eq(cvLinks.contentEntryId, contentEntryId))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load content CV link'))
    )

export const findCvLinksByApplication = (
  database: RegistryQueryDatabase,
  applicationId: string
) =>
  database
    .select()
    .from(cvLinks)
    .where(eq(cvLinks.applicationId, applicationId))
    .orderBy(asc(cvLinks.createdAt), asc(cvLinks.id))
    .pipe(
      Effect.mapError(databaseFailure('Failed to load application CV links'))
    )

export const stageCvLink = (
  database: RegistryQueryDatabase,
  link: PersistedCvLink
) =>
  database
    .insert(cvLinks)
    .values({
      ...link,
      disabledAt: link.updatedAt,
      disabledReason: 'draft_revision',
      enabled: false,
      publicationVersion: 1,
      version: 1,
    })
    .onConflictDoUpdate({
      target: cvLinks.contentEntryId,
      set: {
        currentRevisionId: link.currentRevisionId,
        previewToken: link.previewToken,
        publicUrl: link.publicUrl,
        disabledAt: link.updatedAt,
        disabledReason: 'draft_revision',
        enabled: false,
        updatedAt: link.updatedAt,
        publicationVersion: sql`${cvLinks.publicationVersion} + 1`,
        version: sql`${cvLinks.version} + 1`,
      },
    })
    .pipe(
      Effect.asVoid,
      Effect.mapError(databaseFailure('Failed to stage CV page'))
    )

export const setCvLinkEnabled = (
  database: RegistryQueryDatabase,
  id: string,
  expectedVersion: number,
  expectedPublicationVersion: number,
  enabled: boolean,
  reason: string | null,
  updatedAt: string
) =>
  database
    .update(cvLinks)
    .set({
      enabled,
      disabledAt: enabled ? null : updatedAt,
      disabledReason: enabled ? null : reason,
      updatedAt,
      version: sql`${cvLinks.version} + 1`,
    })
    .where(
      and(
        eq(cvLinks.id, id),
        eq(cvLinks.version, expectedVersion),
        eq(cvLinks.publicationVersion, expectedPublicationVersion)
      )
    )
    .returning({ id: cvLinks.id })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to change CV link availability'))
    )

export const disableCvLinkForFailedArtifact = (
  database: RegistryQueryDatabase,
  id: string,
  expectedVersion: number,
  artifact: PersistedGeneratedArtifact,
  reason: string,
  disabledAt: string
) =>
  database
    .update(cvLinks)
    .set({
      enabled: false,
      disabledAt,
      disabledReason: reason,
      updatedAt: disabledAt,
      version: sql`${cvLinks.version} + 1`,
    })
    .where(
      and(
        eq(cvLinks.id, id),
        eq(cvLinks.version, expectedVersion),
        eq(cvLinks.enabled, true),
        eq(cvLinks.currentRevisionId, artifact.contentRevisionId),
        eq(cvLinks.publicationVersion, artifact.publicationVersion),
        eq(cvLinks.publicUrl, artifact.qrTarget),
        exists(
          database
            .select({ id: generatedArtifacts.id })
            .from(generatedArtifacts)
            .where(
              and(
                eq(generatedArtifacts.id, artifact.id),
                eq(generatedArtifacts.cvLinkId, id),
                eq(
                  generatedArtifacts.contentRevisionId,
                  artifact.contentRevisionId
                ),
                eq(generatedArtifacts.kind, 'pdf'),
                eq(generatedArtifacts.status, 'failed'),
                eq(
                  generatedArtifacts.publicationVersion,
                  artifact.publicationVersion
                ),
                eq(generatedArtifacts.qrTarget, artifact.qrTarget)
              )
            )
        ),
        notExists(
          database
            .select({ id: generatedArtifacts.id })
            .from(generatedArtifacts)
            .where(
              and(
                eq(generatedArtifacts.cvLinkId, id),
                eq(
                  generatedArtifacts.contentRevisionId,
                  artifact.contentRevisionId
                ),
                eq(generatedArtifacts.kind, 'pdf'),
                eq(
                  generatedArtifacts.publicationVersion,
                  artifact.publicationVersion
                ),
                eq(generatedArtifacts.qrTarget, artifact.qrTarget),
                or(
                  gt(generatedArtifacts.createdAt, artifact.createdAt),
                  and(
                    eq(generatedArtifacts.createdAt, artifact.createdAt),
                    gt(generatedArtifacts.id, artifact.id)
                  )
                )
              )
            )
        )
      )
    )
    .returning({ id: cvLinks.id })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(
        databaseFailure('Failed to disable CV link for failed PDF artifact')
      )
    )

export const disableCvLinksForApplication = (
  database: RegistryQueryDatabase,
  applicationId: string,
  reason: string,
  disabledAt: string
) =>
  database
    .update(cvLinks)
    .set({
      enabled: false,
      disabledAt,
      disabledReason: reason,
      updatedAt: disabledAt,
      version: sql`${cvLinks.version} + 1`,
    })
    .where(
      and(eq(cvLinks.applicationId, applicationId), eq(cvLinks.enabled, true))
    )
    .returning({ id: cvLinks.id })
    .pipe(
      Effect.map((rows) => rows.length),
      Effect.mapError(databaseFailure('Failed to disable application CV links'))
    )

export const enableCvLinksForApplication = (
  database: RegistryQueryDatabase,
  applicationId: string,
  disabledReason: string,
  updatedAt: string
) =>
  database
    .update(cvLinks)
    .set({
      enabled: true,
      disabledAt: null,
      disabledReason: null,
      updatedAt,
      version: sql`${cvLinks.version} + 1`,
    })
    .where(
      and(
        eq(cvLinks.applicationId, applicationId),
        eq(cvLinks.enabled, false),
        eq(cvLinks.disabledReason, disabledReason)
      )
    )
    .returning({ id: cvLinks.id })
    .pipe(
      Effect.map((rows) => rows.length),
      Effect.mapError(databaseFailure('Failed to enable application CV links'))
    )

export const findArtifact = (database: RegistryQueryDatabase, id: string) =>
  database
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.id, id))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load generated artifact'))
    )

export const findArtifactByRequestId = (
  database: RegistryQueryDatabase,
  requestId: string
) =>
  database
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.requestId, requestId))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load PDF request artifact'))
    )

export const findReadyArtifactForPublication = (
  database: RegistryQueryDatabase,
  cvLinkId: string,
  contentRevisionId: string,
  rendererVersion: string | null,
  publicationVersion: number,
  qrTarget: string
) =>
  database
    .select()
    .from(generatedArtifacts)
    .where(
      and(
        eq(generatedArtifacts.cvLinkId, cvLinkId),
        eq(generatedArtifacts.contentRevisionId, contentRevisionId),
        eq(generatedArtifacts.kind, 'pdf'),
        rendererVersion === null
          ? sql`true`
          : eq(generatedArtifacts.rendererVersion, rendererVersion),
        eq(generatedArtifacts.publicationVersion, publicationVersion),
        eq(generatedArtifacts.qrTarget, qrTarget),
        eq(generatedArtifacts.status, 'ready')
      )
    )
    .orderBy(desc(generatedArtifacts.updatedAt), desc(generatedArtifacts.id))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load publication PDF'))
    )

export const findCurrentArtifactForPublication = (
  database: RegistryQueryDatabase,
  cvLinkId: string,
  contentRevisionId: string,
  rendererVersion: string | null,
  publicationVersion: number,
  qrTarget: string
) =>
  database
    .select()
    .from(generatedArtifacts)
    .where(
      and(
        eq(generatedArtifacts.cvLinkId, cvLinkId),
        eq(generatedArtifacts.contentRevisionId, contentRevisionId),
        eq(generatedArtifacts.kind, 'pdf'),
        rendererVersion === null
          ? sql`true`
          : eq(generatedArtifacts.rendererVersion, rendererVersion),
        eq(generatedArtifacts.publicationVersion, publicationVersion),
        eq(generatedArtifacts.qrTarget, qrTarget)
      )
    )
    .orderBy(desc(generatedArtifacts.createdAt), desc(generatedArtifacts.id))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load current CV PDF artifact'))
    )

export const persistPendingArtifact = (
  database: RegistryConnections,
  artifact: PersistedGeneratedArtifact,
  outbox: PersistedPdfGenerationOutbox,
  expectedLinkVersion: number
) => {
  const artifactInsert = database.batch
    .insert(generatedArtifacts)
    .select(
      database.batch
        .select({
          id: sql<string>`${artifact.id}`.as('id'),
          cvLinkId: sql<string>`${artifact.cvLinkId}`.as('cv_link_id'),
          contentRevisionId: sql<string>`${artifact.contentRevisionId}`.as(
            'content_revision_id'
          ),
          kind: sql<PersistedGeneratedArtifact['kind']>`${artifact.kind}`.as(
            'kind'
          ),
          status: sql<
            PersistedGeneratedArtifact['status']
          >`${artifact.status}`.as('status'),
          requestId: sql<string>`${artifact.requestId}`.as('request_id'),
          rendererVersion: sql<string>`${artifact.rendererVersion}`.as(
            'renderer_version'
          ),
          publicationVersion: sql<number>`${artifact.publicationVersion}`.as(
            'publication_version'
          ),
          qrTarget: sql<string>`${artifact.qrTarget}`.as('qr_target'),
          objectKey: sql<string | null>`${artifact.objectKey}`.as('object_key'),
          sha256: sql<string | null>`${artifact.sha256}`.as('sha256'),
          byteLength: sql<number | null>`${artifact.byteLength}`.as(
            'byte_length'
          ),
          mediaType: sql<string | null>`${artifact.mediaType}`.as('media_type'),
          errorCode: sql<string | null>`${artifact.errorCode}`.as('error_code'),
          errorMessage: sql<string | null>`${artifact.errorMessage}`.as(
            'error_message'
          ),
          generatedAt: sql<string | null>`${artifact.generatedAt}`.as(
            'generated_at'
          ),
          createdAt: sql<string>`${artifact.createdAt}`.as('created_at'),
          updatedAt: sql<string>`${artifact.updatedAt}`.as('updated_at'),
        })
        .from(cvLinks)
        .where(
          and(
            eq(cvLinks.id, artifact.cvLinkId),
            eq(cvLinks.version, expectedLinkVersion),
            eq(cvLinks.currentRevisionId, artifact.contentRevisionId),
            eq(cvLinks.publicationVersion, artifact.publicationVersion),
            eq(cvLinks.publicUrl, artifact.qrTarget)
          )
        )
    )
    .onConflictDoNothing({ target: generatedArtifacts.requestId })

  const outboxInsert = database.batch
    .insert(pdfGenerationOutbox)
    .select(
      database.batch
        .select({
          applicationId: sql<string>`${outbox.applicationId}`.as(
            'application_id'
          ),
          artifactId: generatedArtifacts.id,
          attempts: sql<number>`${outbox.attempts}`.as('attempts'),
          contentEntryId: sql<string>`${outbox.contentEntryId}`.as(
            'content_entry_id'
          ),
          createdAt: sql<string>`${outbox.createdAt}`.as('created_at'),
          dispatchedAt: sql<string | null>`${outbox.dispatchedAt}`.as(
            'dispatched_at'
          ),
          lastAttemptAt: sql<string | null>`${outbox.lastAttemptAt}`.as(
            'last_attempt_at'
          ),
          lastError: sql<string | null>`${outbox.lastError}`.as('last_error'),
          messageVersion: sql<number>`${outbox.messageVersion}`.as(
            'message_version'
          ),
          updatedAt: sql<string>`${outbox.updatedAt}`.as('updated_at'),
        })
        .from(generatedArtifacts)
        .where(eq(generatedArtifacts.requestId, artifact.requestId))
    )
    .onConflictDoNothing({ target: pdfGenerationOutbox.artifactId })

  return runBatch(database.batch, 'PDF job creation', [
    artifactInsert,
    outboxInsert,
  ]).pipe(Effect.asVoid)
}

export const findPendingPdfDispatch = (
  database: RegistryQueryDatabase,
  artifactId: string
) =>
  database
    .select()
    .from(pdfGenerationOutbox)
    .where(
      and(
        eq(pdfGenerationOutbox.artifactId, artifactId),
        sql`${pdfGenerationOutbox.dispatchedAt} is null`
      )
    )
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load pending PDF dispatch'))
    )

export const listPendingPdfDispatches = (
  database: RegistryQueryDatabase,
  limit: number
) =>
  database
    .select()
    .from(pdfGenerationOutbox)
    .where(sql`${pdfGenerationOutbox.dispatchedAt} is null`)
    .orderBy(asc(pdfGenerationOutbox.createdAt))
    .limit(limit)
    .pipe(
      Effect.mapError(databaseFailure('Failed to list pending PDF dispatches'))
    )

export const markPdfDispatchFailed = (
  database: RegistryQueryDatabase,
  artifactId: string,
  message: string,
  attemptedAt: string
) =>
  database
    .update(pdfGenerationOutbox)
    .set({
      attempts: sql`${pdfGenerationOutbox.attempts} + 1`,
      lastAttemptAt: attemptedAt,
      lastError: message,
      updatedAt: attemptedAt,
    })
    .where(
      and(
        eq(pdfGenerationOutbox.artifactId, artifactId),
        sql`${pdfGenerationOutbox.dispatchedAt} is null`
      )
    )
    .returning({ artifactId: pdfGenerationOutbox.artifactId })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to record PDF dispatch failure'))
    )

export const markPdfDispatched = (
  database: RegistryQueryDatabase,
  artifactId: string,
  dispatchedAt: string
) =>
  database
    .update(pdfGenerationOutbox)
    .set({
      attempts: sql`${pdfGenerationOutbox.attempts} + 1`,
      dispatchedAt,
      lastAttemptAt: dispatchedAt,
      lastError: null,
      updatedAt: dispatchedAt,
    })
    .where(
      and(
        eq(pdfGenerationOutbox.artifactId, artifactId),
        sql`${pdfGenerationOutbox.dispatchedAt} is null`
      )
    )
    .returning({ artifactId: pdfGenerationOutbox.artifactId })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to mark PDF dispatch complete'))
    )

export const markArtifactReady = (
  database: RegistryQueryDatabase,
  artifact: PersistedGeneratedArtifact
) =>
  database
    .update(generatedArtifacts)
    .set({
      status: 'ready',
      objectKey: artifact.objectKey,
      sha256: artifact.sha256,
      byteLength: artifact.byteLength,
      mediaType: artifact.mediaType,
      rendererVersion: artifact.rendererVersion,
      errorCode: null,
      errorMessage: null,
      generatedAt: artifact.generatedAt,
      updatedAt: artifact.updatedAt,
    })
    .where(
      and(
        eq(generatedArtifacts.id, artifact.id),
        eq(generatedArtifacts.status, 'pending'),
        exists(
          database
            .select({ id: cvLinks.id })
            .from(cvLinks)
            .where(
              and(
                eq(cvLinks.id, artifact.cvLinkId),
                eq(cvLinks.publicationVersion, artifact.publicationVersion),
                eq(cvLinks.publicUrl, artifact.qrTarget),
                eq(cvLinks.currentRevisionId, artifact.contentRevisionId)
              )
            )
        )
      )
    )
    .returning({ id: generatedArtifacts.id })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to complete generated artifact'))
    )

export const markArtifactFailed = (
  database: RegistryQueryDatabase,
  id: string,
  errorCode: string,
  errorMessage: string,
  updatedAt: string
) =>
  database
    .update(generatedArtifacts)
    .set({ status: 'failed', errorCode, errorMessage, updatedAt })
    .where(
      and(
        eq(generatedArtifacts.id, id),
        eq(generatedArtifacts.status, 'pending')
      )
    )
    .returning({ id: generatedArtifacts.id })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to record artifact failure'))
    )
