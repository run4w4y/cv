import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { Effect } from 'effect'

import {
  ApplicationsCrud,
  ArtifactsCrud,
  ContentCrud,
  CvLinksCrud,
  FactsReleasesCrud,
  JobPostingSnapshotsCrud,
  type PersistedApplication,
  type PersistedContentRevision,
  type PersistedFactsRelease,
  type PersistedGeneratedArtifact,
} from '../src'
import { makeRegistryCrudLive } from '../src/live'
import { RegistryMiniflareHarness } from '../src/test-support'

let harness: RegistryMiniflareHarness

const recordedAt = '2026-07-17T12:00:00.000Z'

const application: PersistedApplication = {
  applicationId: 'content-application-1',
  canonicalUrl: 'https://example.test/jobs/content-1',
  company: 'Content Test',
  jobKey: 'test:content-1',
  location: 'Remote',
  recordedAt,
  role: 'Platform Engineer',
  source: 'test',
  sourceJobId: null,
}

const factsRelease = (
  id: string,
  sourceCommit: string
): PersistedFactsRelease => ({
  release: {
    id,
    compilerCommit: 'compiler-commit-1',
    compilerRepository: 'cv',
    createdAt: recordedAt,
    factsSchemaVersion: 'cv.facts.v1',
    manifestByteLength: 128,
    manifestObjectKey: `sha256/${id}-manifest`,
    manifestSha256: `${id}-manifest`,
    sourceCommit,
    sourceRepository: 'cv-content',
  },
  catalogs: [
    {
      byteLength: 512,
      locale: 'en',
      mediaType: 'application/json',
      objectKey: `sha256/${id}-catalog`,
      releaseId: id,
      sha256: `${id}-catalog`,
    },
  ],
  assets: [
    {
      assetId: 'portrait',
      byteLength: 1_024,
      fileName: 'portrait.webp',
      mediaType: 'image/webp',
      objectKey: `sha256/${id}-portrait`,
      releaseId: id,
      sha256: `${id}-portrait`,
    },
  ],
})

const revision = (
  id: string,
  revisionNumber: number,
  parentRevisionId: string | null
): PersistedContentRevision => ({
  byteLength: 256 + revisionNumber,
  contentEntryId: 'content-entry-1',
  contractId: 'cv.document',
  contractVersion: '1',
  createdAt: recordedAt,
  factsReleaseId: 'facts-release-1',
  id,
  jobSnapshotId: 'job-snapshot-1',
  mediaType: 'application/json',
  objectKey: `sha256/${id}`,
  operationId: `operation-${id}`,
  parentRevisionId,
  revisionNumber,
  sha256: id,
  source: revisionNumber === 1 ? 'ai' : 'human',
})

const artifact = (
  overrides: Partial<PersistedGeneratedArtifact> = {}
): PersistedGeneratedArtifact => ({
  byteLength: null,
  contentRevisionId: 'content-revision-2',
  createdAt: recordedAt,
  cvLinkId: 'cv-link-1',
  errorCode: null,
  errorMessage: null,
  generatedAt: null,
  id: 'pdf-artifact-1',
  kind: 'pdf',
  mediaType: null,
  objectKey: null,
  publicationVersion: 1,
  qrTarget: 'https://cv.example.test/cv/public-token-1',
  rendererVersion: 'renderer-v1',
  sha256: null,
  status: 'pending',
  updatedAt: recordedAt,
  workflowId: 'workflow-1',
  ...overrides,
})

const runCrud = <A, E>(
  program: Effect.Effect<
    A,
    E,
    | ApplicationsCrud
    | ArtifactsCrud
    | ContentCrud
    | CvLinksCrud
    | FactsReleasesCrud
    | JobPostingSnapshotsCrud
  >
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(makeRegistryCrudLive(Effect.succeed(harness.database)))
    )
  )

const seedApplication = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  yield* applications.persist(application, {
    mode: 'replace',
    operation: 'content integration application seed',
  })
})

beforeEach(async () => {
  harness = await RegistryMiniflareHarness.make({
    databaseBinding: 'APPLICATION_REGISTRY_DB',
  })
})

afterEach(async () => {
  await harness.dispose()
})

test('registers immutable facts releases and activates them with compare-and-swap', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const facts = yield* FactsReleasesCrud
      yield* facts.register(factsRelease('facts-release-1', 'source-commit-1'))
      yield* facts.register(factsRelease('facts-release-2', 'source-commit-2'))

      const created = yield* facts.activate(
        'stable',
        'facts-release-1',
        0,
        recordedAt
      )
      const stale = yield* facts.activate(
        'stable',
        'facts-release-2',
        0,
        recordedAt
      )
      const advanced = yield* facts.activate(
        'stable',
        'facts-release-2',
        1,
        '2026-07-17T13:00:00.000Z'
      )

      return {
        active: yield* facts.findActiveCatalog('stable', 'en'),
        advanced,
        assets: yield* facts.assets('facts-release-2'),
        created,
        stale,
      }
    })
  )

  assert.equal(result.created, true)
  assert.equal(result.stale, false)
  assert.equal(result.advanced, true)
  assert.equal(result.active?.release.id, 'facts-release-2')
  assert.equal(result.active?.channel.version, 2)
  assert.equal(result.active?.catalog.locale, 'en')
  assert.deepEqual(
    result.assets.map(({ assetId }) => assetId),
    ['portrait']
  )
})

test('keeps content history linear and preserves the public token across publications', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const content = yield* ContentCrud
      const facts = yield* FactsReleasesCrud
      const links = yield* CvLinksCrud
      const snapshots = yield* JobPostingSnapshotsCrud

      yield* seedApplication
      yield* facts.register(factsRelease('facts-release-1', 'source-commit-1'))
      yield* snapshots.persist({
        applicationId: application.applicationId,
        errorCode: null,
        errorMessage: null,
        fetchedAt: recordedAt,
        fetcherVersion: 'fetcher-v1',
        finalUrl: application.canonicalUrl,
        id: 'job-snapshot-1',
        normalizedByteLength: 100,
        normalizedMediaType: 'text/plain',
        normalizedObjectKey: 'sha256/job-normalized',
        normalizedSha256: 'job-normalized',
        rawByteLength: 200,
        rawMediaType: 'text/html',
        rawObjectKey: 'sha256/job-raw',
        rawSha256: 'job-raw',
        requestedUrl: application.canonicalUrl,
        status: 'fetched',
      })
      yield* content.createEntry({
        applicationId: application.applicationId,
        createdAt: recordedAt,
        id: 'content-entry-1',
        kind: 'cv',
        locale: 'en',
        updatedAt: recordedAt,
      })

      const first = yield* content.appendRevision(
        revision('content-revision-1', 1, null),
        1,
        recordedAt
      )
      const stale = yield* content.appendRevision(
        revision('stale-revision', 2, 'content-revision-1'),
        1,
        recordedAt
      )
      const approvedFirst = yield* content.approve(
        'content-entry-1',
        'content-revision-1',
        2,
        recordedAt
      )

      yield* links.publish({
        applicationId: application.applicationId,
        contentEntryId: 'content-entry-1',
        createdAt: recordedAt,
        id: 'cv-link-1',
        publishedRevisionId: 'content-revision-1',
        publicUrl: 'https://cv.example.test/cv/public-token-1',
        token: 'public-token-1',
        updatedAt: recordedAt,
      })

      const second = yield* content.appendRevision(
        revision('content-revision-2', 2, 'content-revision-1'),
        3,
        '2026-07-17T13:00:00.000Z'
      )
      const approvedSecond = yield* content.approve(
        'content-entry-1',
        'content-revision-2',
        4,
        '2026-07-17T13:01:00.000Z'
      )
      yield* links.publish({
        applicationId: application.applicationId,
        contentEntryId: 'content-entry-1',
        createdAt: '2026-07-17T13:02:00.000Z',
        id: 'replacement-link-id',
        publishedRevisionId: 'content-revision-2',
        publicUrl: 'https://cv.example.test/cv/replacement-token',
        token: 'replacement-token',
        updatedAt: '2026-07-17T13:02:00.000Z',
      })

      const disabled = yield* links.disableForApplication(
        application.applicationId,
        'application_rejected',
        '2026-07-17T14:00:00.000Z'
      )
      const disabledLink = yield* links.findByEntry('content-entry-1')
      const restored = yield* links.enableForApplication(
        application.applicationId,
        'application_rejected',
        '2026-07-17T14:30:00.000Z'
      )
      yield* links.setEnabled(
        'cv-link-1',
        disabledLink?.version ?? -1,
        disabledLink?.publicationVersion ?? -1,
        false,
        'manual_pause',
        '2026-07-17T14:45:00.000Z'
      )
      const manuallyDisabledLink = yield* links.findByEntry('content-entry-1')
      const manualNotRestored = yield* links.enableForApplication(
        application.applicationId,
        'application_rejected',
        '2026-07-17T14:50:00.000Z'
      )
      const enabled = yield* links.setEnabled(
        'cv-link-1',
        manuallyDisabledLink?.version ?? -1,
        manuallyDisabledLink?.publicationVersion ?? -1,
        true,
        null,
        '2026-07-17T15:00:00.000Z'
      )

      return {
        approvedFirst,
        approvedSecond,
        disabled,
        disabledLink,
        enabled,
        entry: yield* content.findEntry('content-entry-1'),
        first,
        latestSnapshot: yield* snapshots.latest(application.applicationId),
        link: yield* links.findByEntry('content-entry-1'),
        manualNotRestored,
        revisions: yield* content.listRevisions('content-entry-1'),
        restored,
        second,
        stale,
      }
    })
  )

  assert.equal(result.first, true)
  assert.equal(result.stale, false)
  assert.equal(result.approvedFirst, true)
  assert.equal(result.second, true)
  assert.equal(result.approvedSecond, true)
  assert.equal(result.entry?.headRevisionId, 'content-revision-2')
  assert.equal(result.entry?.approvedRevisionId, 'content-revision-2')
  assert.equal(result.entry?.version, 5)
  assert.deepEqual(
    result.revisions.map(({ id }) => id),
    ['content-revision-1', 'content-revision-2']
  )
  assert.equal(result.latestSnapshot?.id, 'job-snapshot-1')
  assert.equal(result.disabled, 1)
  assert.equal(result.disabledLink?.enabled, false)
  assert.equal(result.disabledLink?.disabledReason, 'application_rejected')
  assert.equal(result.restored, 0)
  assert.equal(result.manualNotRestored, 0)
  assert.equal(result.enabled, false)
  assert.equal(result.link?.id, 'cv-link-1')
  assert.equal(result.link?.token, 'public-token-1')
  assert.equal(
    result.link?.publicUrl,
    'https://cv.example.test/cv/replacement-token'
  )
  assert.equal(result.link?.publishedRevisionId, 'content-revision-2')
  assert.equal(result.link?.enabled, false)
})

test('moves a PDF artifact from pending to ready without losing its QR target', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const artifacts = yield* ArtifactsCrud
      const content = yield* ContentCrud
      const facts = yield* FactsReleasesCrud
      const links = yield* CvLinksCrud
      const snapshots = yield* JobPostingSnapshotsCrud

      yield* seedApplication
      yield* facts.register(factsRelease('facts-release-1', 'source-commit-1'))
      yield* snapshots.persist({
        applicationId: application.applicationId,
        errorCode: null,
        errorMessage: null,
        fetchedAt: recordedAt,
        fetcherVersion: 'fetcher-v1',
        finalUrl: application.canonicalUrl,
        id: 'job-snapshot-1',
        normalizedByteLength: null,
        normalizedMediaType: null,
        normalizedObjectKey: null,
        normalizedSha256: null,
        rawByteLength: null,
        rawMediaType: null,
        rawObjectKey: null,
        rawSha256: null,
        requestedUrl: application.canonicalUrl,
        status: 'provided',
      })
      yield* content.createEntry({
        applicationId: application.applicationId,
        createdAt: recordedAt,
        id: 'content-entry-1',
        kind: 'cv',
        locale: 'en',
        updatedAt: recordedAt,
      })
      yield* content.appendRevision(
        revision('content-revision-1', 1, null),
        1,
        recordedAt
      )
      yield* content.appendRevision(
        revision('content-revision-2', 2, 'content-revision-1'),
        2,
        recordedAt
      )
      yield* content.approve(
        'content-entry-1',
        'content-revision-2',
        3,
        recordedAt
      )
      yield* links.publish({
        applicationId: application.applicationId,
        contentEntryId: 'content-entry-1',
        createdAt: recordedAt,
        id: 'cv-link-1',
        publishedRevisionId: 'content-revision-2',
        publicUrl: 'https://cv.example.test/cv/public-token-1',
        token: 'public-token-1',
        updatedAt: recordedAt,
      })

      yield* artifacts.persistPending(artifact())
      const failed = yield* artifacts.markFailed(
        'pdf-artifact-1',
        'render_failed',
        'Browser failed.',
        '2026-07-17T15:00:00.000Z'
      )
      const retryArtifact = artifact({
        id: 'pdf-artifact-2',
        workflowId: 'workflow-2',
      })
      yield* artifacts.persistPending(retryArtifact)
      yield* artifacts.persistPending(
        artifact({ id: 'pdf-artifact-duplicate', workflowId: 'workflow-2' })
      )
      const ready = yield* artifacts.markReady({
        ...retryArtifact,
        byteLength: 8_192,
        generatedAt: '2026-07-17T16:00:00.000Z',
        mediaType: 'application/pdf',
        objectKey: 'sha256/pdf-ready',
        sha256: 'pdf-ready',
        status: 'ready',
        updatedAt: '2026-07-17T16:00:00.000Z',
      })
      const published = yield* links.findByEntry('content-entry-1')
      const disabled = yield* links.setEnabled(
        'cv-link-1',
        published?.version ?? -1,
        published?.publicationVersion ?? -1,
        false,
        'manual_pause',
        '2026-07-17T16:30:00.000Z'
      )
      const disabledLink = yield* links.findByEntry('content-entry-1')
      const enabled = yield* links.setEnabled(
        'cv-link-1',
        disabledLink?.version ?? -1,
        disabledLink?.publicationVersion ?? -1,
        true,
        null,
        '2026-07-17T17:00:00.000Z'
      )

      return {
        disabled,
        disabledLink,
        enabled,
        failed,
        fallback: yield* artifacts.findReadyForPublication(
          'cv-link-1',
          'content-revision-2',
          null,
          1,
          'https://cv.example.test/cv/public-token-1'
        ),
        found: yield* artifacts.findReadyForPublication(
          'cv-link-1',
          'content-revision-2',
          'renderer-v1',
          1,
          'https://cv.example.test/cv/public-token-1'
        ),
        missingNewRenderer: yield* artifacts.findReadyForPublication(
          'cv-link-1',
          'content-revision-2',
          'renderer-v2',
          1,
          'https://cv.example.test/cv/public-token-1'
        ),
        published,
        ready,
        retryByWorkflow: yield* artifacts.findByWorkflowId('workflow-2'),
        restoredLink: yield* links.findByEntry('content-entry-1'),
      }
    })
  )

  assert.equal(result.ready, true)
  assert.equal(result.failed, true)
  assert.equal(result.disabled, true)
  assert.equal(result.enabled, true)
  assert.equal(result.missingNewRenderer, undefined)
  assert.equal(result.fallback?.id, 'pdf-artifact-2')
  assert.equal(
    result.disabledLink?.publicationVersion,
    result.published?.publicationVersion
  )
  assert.equal(
    result.restoredLink?.publicationVersion,
    result.published?.publicationVersion
  )
  assert.equal(
    result.restoredLink?.version,
    (result.published?.version ?? 0) + 2
  )
  assert.equal(result.retryByWorkflow?.id, 'pdf-artifact-2')
  assert.equal(result.found?.status, 'ready')
  assert.equal(result.found?.mediaType, 'application/pdf')
  assert.equal(result.found?.objectKey, 'sha256/pdf-ready')
  assert.equal(
    result.found?.qrTarget,
    'https://cv.example.test/cv/public-token-1'
  )
})

test('deleting an application cascades through its complete prepared CV graph', async () => {
  const removed = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const artifacts = yield* ArtifactsCrud
      const content = yield* ContentCrud
      const facts = yield* FactsReleasesCrud
      const links = yield* CvLinksCrud
      const snapshots = yield* JobPostingSnapshotsCrud

      yield* seedApplication
      yield* facts.register(factsRelease('facts-release-1', 'source-commit-1'))
      yield* snapshots.persist({
        applicationId: application.applicationId,
        errorCode: null,
        errorMessage: null,
        fetchedAt: recordedAt,
        fetcherVersion: 'fetcher-v1',
        finalUrl: application.canonicalUrl,
        id: 'job-snapshot-1',
        normalizedByteLength: 100,
        normalizedMediaType: 'text/plain',
        normalizedObjectKey: 'sha256/job-normalized',
        normalizedSha256: 'job-normalized',
        rawByteLength: 200,
        rawMediaType: 'text/html',
        rawObjectKey: 'sha256/job-raw',
        rawSha256: 'job-raw',
        requestedUrl: application.canonicalUrl,
        status: 'fetched',
      })
      yield* content.createEntry({
        applicationId: application.applicationId,
        createdAt: recordedAt,
        id: 'content-entry-1',
        kind: 'cv',
        locale: 'en',
        updatedAt: recordedAt,
      })
      yield* content.appendRevision(
        revision('content-revision-1', 1, null),
        1,
        recordedAt
      )
      yield* content.approve(
        'content-entry-1',
        'content-revision-1',
        2,
        recordedAt
      )
      yield* links.publish({
        applicationId: application.applicationId,
        contentEntryId: 'content-entry-1',
        createdAt: recordedAt,
        id: 'cv-link-1',
        publishedRevisionId: 'content-revision-1',
        publicUrl: 'https://cv.example.test/c/public-token-1',
        token: 'public-token-1',
        updatedAt: recordedAt,
      })
      yield* artifacts.persistPending(
        artifact({ contentRevisionId: 'content-revision-1' })
      )

      return yield* applications.remove(application.applicationId)
    })
  )

  assert.equal(removed, true)

  const ownedRows = await harness.query<{ count: number; relation: string }>(
    `select 'job_posting_snapshots' as relation, count(*) as count
       from job_posting_snapshots where application_id = ?1
     union all
     select 'content_entries', count(*)
       from content_entries where application_id = ?1
     union all
     select 'content_revisions', count(*)
       from content_revisions where content_entry_id = 'content-entry-1'
     union all
     select 'cv_links', count(*)
       from cv_links where application_id = ?1
     union all
     select 'generated_artifacts', count(*)
       from generated_artifacts where id = 'pdf-artifact-1'`,
    [application.applicationId]
  )

  assert.deepEqual(
    ownedRows,
    [
      'job_posting_snapshots',
      'content_entries',
      'content_revisions',
      'cv_links',
      'generated_artifacts',
    ].map((relation) => ({ count: 0, relation }))
  )

  const globalFacts = await harness.query<{ count: number }>(
    `select count(*) as count from facts_releases where id = ?1`,
    ['facts-release-1']
  )
  assert.deepEqual(globalFacts, [{ count: 1 }])
})
