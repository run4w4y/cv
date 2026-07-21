import {
  contentEntries,
  contentRevisions,
  cvLinks,
  generatedArtifacts,
  jobPostingSnapshots,
  pdfGenerationOutbox,
} from '@cv/application-registry-entity'
import { and, asc, desc, eq, exists, gt, notExists, or, sql } from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure } from '../errors'
import type { RegistryDatabase, RegistryExecutor } from '../internal/connection'
import type {
  PersistedContentEntry,
  PersistedContentRevision,
  PersistedCvLink,
  PersistedGeneratedArtifact,
  PersistedJobPostingSnapshot,
  PersistedPdfGenerationOutbox,
} from '../types'
import { runTransaction } from './shared'

const first = <A>(rows: readonly A[]) => rows.at(0)

export const findJobPostingSnapshot = (
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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

export const findContentEntry = (database: RegistryExecutor, id: string) =>
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
  database: RegistryExecutor,
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

export const findContentRevision = (database: RegistryExecutor, id: string) =>
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
  database: RegistryExecutor,
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
  database: RegistryDatabase,
  revision: PersistedContentRevision,
  expectedEntryVersion: number,
  updatedAt: string
) =>
  runTransaction(database, 'content revision append', (transaction) =>
    Effect.gen(function* () {
      const eligibleEntry = and(
        eq(contentEntries.id, revision.contentEntryId),
        eq(contentEntries.version, expectedEntryVersion),
        nullableEquals(contentEntries.headRevisionId, revision.parentRevisionId)
      )
      const entries = yield* transaction
        .select({ id: contentEntries.id })
        .from(contentEntries)
        .where(eligibleEntry)
        .for('update')
        .limit(1)
      const entry = entries.at(0)

      if (entry === undefined) return false

      yield* transaction.insert(contentRevisions).values(revision)

      const updated = yield* transaction
        .update(contentEntries)
        .set({
          headRevisionId: revision.id,
          state: 'draft',
          updatedAt,
          version: sql`${contentEntries.version} + 1`,
        })
        .where(and(eligibleEntry, eq(contentEntries.id, entry.id)))
        .returning({ id: contentEntries.id })

      if (updated.length === 0) {
        return yield* Effect.fail(
          new Error('The content entry could not be advanced.')
        )
      }

      return true
    })
  )

export const approveContentRevision = (
  database: RegistryExecutor,
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

export const findCvLinkByToken = (database: RegistryExecutor, token: string) =>
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryDatabase,
  link: PersistedCvLink,
  expectedContentVersion: number
) =>
  runTransaction(database, 'CV page staging', (transaction) =>
    Effect.gen(function* () {
      const entry = yield* transaction
        .select({ id: contentEntries.id })
        .from(contentEntries)
        .where(
          and(
            eq(contentEntries.id, link.contentEntryId),
            eq(contentEntries.applicationId, link.applicationId),
            eq(contentEntries.version, expectedContentVersion)
          )
        )
        .limit(1)
        .for('update')
        .pipe(Effect.map((rows) => rows.at(0)))

      if (entry === undefined) return false

      const existing = yield* transaction
        .select({
          applicationId: cvLinks.applicationId,
          currentRevisionId: cvLinks.currentRevisionId,
          id: cvLinks.id,
          publicUrl: cvLinks.publicUrl,
          token: cvLinks.token,
        })
        .from(cvLinks)
        .where(eq(cvLinks.contentEntryId, link.contentEntryId))
        .limit(1)
        .for('update')
        .pipe(Effect.map((rows) => rows.at(0)))

      if (existing === undefined) {
        const inserted = yield* transaction
          .insert(cvLinks)
          .values({
            ...link,
            disabledAt: link.updatedAt,
            disabledReason: 'draft_revision',
            enabled: false,
            publicationVersion: 1,
            version: 1,
          })
          .returning({ id: cvLinks.id })

        if (inserted.length !== 1) {
          return yield* Effect.fail(
            new Error('The new CV page could not be staged.')
          )
        }
        return true
      }

      if (
        existing.applicationId !== link.applicationId ||
        existing.id !== link.id ||
        existing.token !== link.token
      ) {
        return false
      }

      if (
        existing.currentRevisionId === link.currentRevisionId &&
        existing.publicUrl === link.publicUrl
      ) {
        return true
      }

      const updated = yield* transaction
        .update(cvLinks)
        .set({
          currentRevisionId: link.currentRevisionId,
          previewToken: link.previewToken,
          publicUrl: link.publicUrl,
          disabledAt: link.updatedAt,
          disabledReason: 'draft_revision',
          enabled: false,
          updatedAt: link.updatedAt,
          publicationVersion: sql`${cvLinks.publicationVersion} + 1`,
          version: sql`${cvLinks.version} + 1`,
        })
        .where(
          and(
            eq(cvLinks.contentEntryId, link.contentEntryId),
            eq(cvLinks.applicationId, link.applicationId),
            eq(cvLinks.id, link.id),
            eq(cvLinks.token, link.token)
          )
        )
        .returning({ id: cvLinks.id })

      if (updated.length !== 1) {
        return yield* Effect.fail(
          new Error('The existing CV page could not be staged.')
        )
      }

      return true
    })
  )

export const setCvLinkEnabled = (
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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

export const findArtifact = (database: RegistryExecutor, id: string) =>
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryDatabase,
  artifact: PersistedGeneratedArtifact,
  outbox: PersistedPdfGenerationOutbox,
  expectedLinkVersion: number
) =>
  runTransaction(database, 'PDF job creation', (transaction) =>
    Effect.gen(function* () {
      const currentLinks = yield* transaction
        .select({ id: cvLinks.id })
        .from(cvLinks)
        .where(
          and(
            eq(cvLinks.id, artifact.cvLinkId),
            eq(cvLinks.version, expectedLinkVersion),
            eq(cvLinks.enabled, true),
            eq(cvLinks.currentRevisionId, artifact.contentRevisionId),
            eq(cvLinks.publicationVersion, artifact.publicationVersion),
            eq(cvLinks.publicUrl, artifact.qrTarget)
          )
        )
        .for('update')
        .limit(1)

      if (currentLinks.length === 0) return

      yield* transaction
        .insert(generatedArtifacts)
        .values(artifact)
        .onConflictDoNothing({ target: generatedArtifacts.requestId })

      const storedArtifacts = yield* transaction
        .select({ id: generatedArtifacts.id })
        .from(generatedArtifacts)
        .where(eq(generatedArtifacts.requestId, artifact.requestId))
        .limit(1)
      const storedArtifact = storedArtifacts.at(0)

      if (storedArtifact === undefined) {
        return yield* Effect.fail(
          new Error('The pending PDF artifact was not persisted.')
        )
      }

      yield* transaction
        .insert(pdfGenerationOutbox)
        .values({ ...outbox, artifactId: storedArtifact.id })
        .onConflictDoNothing({ target: pdfGenerationOutbox.artifactId })
    })
  )

export const findPendingPdfDispatch = (
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
  database: RegistryExecutor,
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
