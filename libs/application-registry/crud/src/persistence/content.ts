import {
  contentEntries,
  contentRevisions,
  cvLinks,
  factsChannels,
  factsReleaseAssets,
  factsReleaseCatalogs,
  factsReleases,
  generatedArtifacts,
  jobPostingSnapshots,
} from '@cv/application-registry-entity'
import { and, asc, desc, eq, exists, sql } from 'drizzle-orm'
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
  PersistedFactsRelease,
  PersistedGeneratedArtifact,
  PersistedJobPostingSnapshot,
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

export const findFactsRelease = (
  database: RegistryQueryDatabase,
  releaseId: string
) =>
  database
    .select()
    .from(factsReleases)
    .where(eq(factsReleases.id, releaseId))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load facts release'))
    )

export const listFactsReleaseCatalogs = (
  database: RegistryQueryDatabase,
  releaseId: string
) =>
  database
    .select()
    .from(factsReleaseCatalogs)
    .where(eq(factsReleaseCatalogs.releaseId, releaseId))
    .orderBy(asc(factsReleaseCatalogs.locale))
    .pipe(Effect.mapError(databaseFailure('Failed to list facts catalogs')))

export const listFactsReleaseAssets = (
  database: RegistryQueryDatabase,
  releaseId: string
) =>
  database
    .select()
    .from(factsReleaseAssets)
    .where(eq(factsReleaseAssets.releaseId, releaseId))
    .orderBy(asc(factsReleaseAssets.assetId))
    .pipe(Effect.mapError(databaseFailure('Failed to list facts assets')))

export const findActiveFactsCatalog = (
  database: RegistryQueryDatabase,
  channel: string,
  locale: string
) =>
  database
    .select({
      channel: factsChannels,
      release: factsReleases,
      catalog: factsReleaseCatalogs,
    })
    .from(factsChannels)
    .innerJoin(
      factsReleases,
      eq(factsChannels.activeReleaseId, factsReleases.id)
    )
    .innerJoin(
      factsReleaseCatalogs,
      and(
        eq(factsReleaseCatalogs.releaseId, factsReleases.id),
        eq(factsReleaseCatalogs.locale, locale)
      )
    )
    .where(eq(factsChannels.name, channel))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load active facts catalog'))
    )

export const registerFactsRelease = (
  database: RegistryConnections,
  input: PersistedFactsRelease
) => {
  const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
    database.batch
      .insert(factsReleases)
      .values(input.release)
      .onConflictDoNothing({ target: factsReleases.id }),
    ...input.catalogs.map((catalog) =>
      database.batch
        .insert(factsReleaseCatalogs)
        .values(catalog)
        .onConflictDoNothing({
          target: [factsReleaseCatalogs.releaseId, factsReleaseCatalogs.locale],
        })
    ),
    ...input.assets.map((asset) =>
      database.batch
        .insert(factsReleaseAssets)
        .values(asset)
        .onConflictDoNothing({
          target: [factsReleaseAssets.releaseId, factsReleaseAssets.assetId],
        })
    ),
  ]

  return runBatch(
    database.batch,
    'facts release registration',
    statements
  ).pipe(Effect.asVoid)
}

export const activateFactsRelease = (
  database: RegistryQueryDatabase,
  channel: string,
  releaseId: string,
  expectedVersion: number,
  updatedAt: string
) =>
  database
    .insert(factsChannels)
    .values({
      name: channel,
      activeReleaseId: releaseId,
      version: 1,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: factsChannels.name,
      set: {
        activeReleaseId: releaseId,
        updatedAt,
        version: sql`${factsChannels.version} + 1`,
      },
      setWhere: eq(factsChannels.version, expectedVersion),
    })
    .returning({ name: factsChannels.name })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to activate facts release'))
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

export const publishCvLink = (
  database: RegistryQueryDatabase,
  link: PersistedCvLink
) =>
  database
    .insert(cvLinks)
    .values({
      ...link,
      disabledAt: null,
      disabledReason: null,
      enabled: true,
      publicationVersion: 1,
      version: 1,
    })
    .onConflictDoUpdate({
      target: cvLinks.contentEntryId,
      set: {
        publishedRevisionId: link.publishedRevisionId,
        publicUrl: link.publicUrl,
        disabledAt: null,
        disabledReason: null,
        enabled: true,
        updatedAt: link.updatedAt,
        publicationVersion: sql`${cvLinks.publicationVersion} + 1`,
        version: sql`${cvLinks.version} + 1`,
      },
    })
    .pipe(
      Effect.asVoid,
      Effect.mapError(databaseFailure('Failed to publish CV link'))
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
        eq(cvLinks.publicationVersion, expectedPublicationVersion),
        enabled
          ? exists(
              database
                .select({ id: generatedArtifacts.id })
                .from(generatedArtifacts)
                .where(
                  and(
                    eq(generatedArtifacts.cvLinkId, cvLinks.id),
                    eq(
                      generatedArtifacts.contentRevisionId,
                      cvLinks.publishedRevisionId
                    ),
                    eq(generatedArtifacts.kind, 'pdf'),
                    eq(generatedArtifacts.status, 'ready'),
                    eq(
                      generatedArtifacts.publicationVersion,
                      cvLinks.publicationVersion
                    ),
                    eq(generatedArtifacts.qrTarget, cvLinks.publicUrl)
                  )
                )
            )
          : sql`true`
      )
    )
    .returning({ id: cvLinks.id })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to change CV link availability'))
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
        eq(cvLinks.disabledReason, disabledReason),
        exists(
          database
            .select({ id: generatedArtifacts.id })
            .from(generatedArtifacts)
            .where(
              and(
                eq(generatedArtifacts.cvLinkId, cvLinks.id),
                eq(
                  generatedArtifacts.contentRevisionId,
                  cvLinks.publishedRevisionId
                ),
                eq(generatedArtifacts.kind, 'pdf'),
                eq(generatedArtifacts.status, 'ready'),
                eq(
                  generatedArtifacts.publicationVersion,
                  cvLinks.publicationVersion
                ),
                eq(generatedArtifacts.qrTarget, cvLinks.publicUrl)
              )
            )
        )
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

export const findArtifactByWorkflowId = (
  database: RegistryQueryDatabase,
  workflowId: string
) =>
  database
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.workflowId, workflowId))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load Workflow artifact'))
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

export const persistPendingArtifact = (
  database: RegistryQueryDatabase,
  artifact: PersistedGeneratedArtifact
) =>
  database
    .insert(generatedArtifacts)
    .values(artifact)
    .onConflictDoNothing({
      target: generatedArtifacts.workflowId,
    })
    .pipe(
      Effect.asVoid,
      Effect.mapError(databaseFailure('Failed to start generated artifact'))
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
                eq(cvLinks.enabled, true),
                eq(cvLinks.publicationVersion, artifact.publicationVersion),
                eq(cvLinks.publicUrl, artifact.qrTarget),
                eq(cvLinks.publishedRevisionId, artifact.contentRevisionId)
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
