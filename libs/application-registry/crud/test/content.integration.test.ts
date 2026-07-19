import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import { RegistryMiniflareHarness } from '@cv/worker-test-kit/application-registry'
import { Effect } from 'effect'

import {
  ApplicationsCrud,
  ArtifactsCrud,
  ContentCrud,
  CvAnalyticsCrud,
  CvLinksCrud,
  JobPostingSnapshotsCrud,
  type PersistedApplication,
  type PersistedContentRevision,
  type PersistedGeneratedArtifact,
  type PersistedPdfGenerationOutbox,
} from '../src'
import { makeRegistryCrudLive } from '../src/live'

let harness: RegistryMiniflareHarness

const recordedAt = '2026-07-17T12:00:00.000Z'

const application: PersistedApplication = {
  activity: {
    activityId: 'content-application-created',
    actor: 'system',
    kind: 'application_created',
    occurredAt: recordedAt,
    payload: {},
    source: 'migration',
  },
  applicationId: 'content-application-1',
  company: 'Content Test',
  location: 'Remote',
  labels: ['analytics'],
  postingFingerprint: 'https://example.test/jobs/content-1',
  postingUrl: 'https://example.test/jobs/content-1',
  postingUrlNormalized: 'https://example.test/jobs/content-1',
  recordedAt,
  role: 'Platform Engineer',
}

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
  requestId: 'request-1',
  ...overrides,
})

const outbox = (
  value: PersistedGeneratedArtifact
): PersistedPdfGenerationOutbox => ({
  applicationId: application.applicationId,
  artifactId: value.id,
  attempts: 0,
  contentEntryId: 'content-entry-1',
  createdAt: value.createdAt,
  dispatchedAt: null,
  lastAttemptAt: null,
  lastError: null,
  messageVersion: 1,
  updatedAt: value.updatedAt,
})

const runCrud = <A, E>(
  program: Effect.Effect<
    A,
    E,
    | ApplicationsCrud
    | ArtifactsCrud
    | ContentCrud
    | CvAnalyticsCrud
    | CvLinksCrud
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
    operation: 'content integration application seed',
  })
})

before(async () => {
  harness = await RegistryMiniflareHarness.make({
    databaseBinding: 'APPLICATION_REGISTRY_DB',
  })
})

afterEach(async () => {
  await harness.reset()
})

after(async () => {
  await harness.dispose()
})

test('keeps content history linear and preserves page identity while staging revisions', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const content = yield* ContentCrud
      const analytics = yield* CvAnalyticsCrud
      const links = yield* CvLinksCrud
      const snapshots = yield* JobPostingSnapshotsCrud

      yield* seedApplication
      yield* snapshots.persist({
        applicationId: application.applicationId,
        errorCode: null,
        errorMessage: null,
        fetchedAt: recordedAt,
        fetcherVersion: 'fetcher-v1',
        finalUrl: application.postingUrl,
        id: 'job-snapshot-1',
        normalizedByteLength: 100,
        normalizedMediaType: 'text/plain',
        normalizedObjectKey: 'sha256/job-normalized',
        normalizedSha256: 'job-normalized',
        rawByteLength: 200,
        rawMediaType: 'text/html',
        rawObjectKey: 'sha256/job-raw',
        rawSha256: 'job-raw',
        requestedUrl: application.postingUrl,
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

      yield* links.stage({
        applicationId: application.applicationId,
        contentEntryId: 'content-entry-1',
        createdAt: recordedAt,
        currentRevisionId: 'content-revision-1',
        id: 'cv-link-1',
        previewToken: 'preview-token-1',
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
      yield* links.stage({
        applicationId: application.applicationId,
        contentEntryId: 'content-entry-1',
        createdAt: '2026-07-17T13:02:00.000Z',
        currentRevisionId: 'content-revision-2',
        id: 'replacement-link-id',
        previewToken: 'preview-token-2',
        publicUrl: 'https://cv.example.test/cv/replacement-token',
        token: 'replacement-token',
        updatedAt: '2026-07-17T13:02:00.000Z',
      })

      const stagedLink = yield* links.findByEntry('content-entry-1')
      const initiallyEnabled = yield* links.setEnabled(
        'cv-link-1',
        stagedLink?.version ?? -1,
        stagedLink?.publicationVersion ?? -1,
        true,
        null,
        '2026-07-17T13:30:00.000Z'
      )

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
        analyticsLinks: yield* analytics.listLinks(),
        disabled,
        disabledLink,
        enabled,
        entry: yield* content.findEntry('content-entry-1'),
        first,
        initiallyEnabled,
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
  assert.deepEqual(result.analyticsLinks, [
    {
      application: {
        appliedAt: null,
        applicationStatus: 'not_started',
        company: application.company,
        createdAt: recordedAt,
        id: application.applicationId,
        listingAvailability: 'unchecked',
        postingUrl: application.postingUrl,
        role: application.role,
      },
      labels: ['analytics'],
      link: {
        contentEntryId: 'content-entry-1',
        createdAt: recordedAt,
        enabled: true,
        id: 'cv-link-1',
        currentRevisionId: 'content-revision-2',
        token: 'public-token-1',
        updatedAt: '2026-07-17T15:00:00.000Z',
      },
      locale: 'en',
    },
  ])
  assert.equal(result.second, true)
  assert.equal(result.approvedSecond, true)
  assert.equal(result.initiallyEnabled, true)
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
  assert.equal(result.restored, 1)
  assert.equal(result.manualNotRestored, 0)
  assert.equal(result.enabled, true)
  assert.equal(result.link?.id, 'cv-link-1')
  assert.equal(result.link?.token, 'public-token-1')
  assert.equal(
    result.link?.publicUrl,
    'https://cv.example.test/cv/replacement-token'
  )
  assert.equal(result.link?.currentRevisionId, 'content-revision-2')
  assert.equal(result.link?.previewToken, 'preview-token-2')
  assert.equal(result.link?.enabled, true)
})

test('moves a PDF artifact from pending to ready without losing its QR target', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const artifacts = yield* ArtifactsCrud
      const content = yield* ContentCrud
      const links = yield* CvLinksCrud
      const snapshots = yield* JobPostingSnapshotsCrud

      yield* seedApplication
      yield* snapshots.persist({
        applicationId: application.applicationId,
        errorCode: null,
        errorMessage: null,
        fetchedAt: recordedAt,
        fetcherVersion: 'fetcher-v1',
        finalUrl: application.postingUrl,
        id: 'job-snapshot-1',
        normalizedByteLength: null,
        normalizedMediaType: null,
        normalizedObjectKey: null,
        normalizedSha256: null,
        rawByteLength: null,
        rawMediaType: null,
        rawObjectKey: null,
        rawSha256: null,
        requestedUrl: application.postingUrl,
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
      yield* links.stage({
        applicationId: application.applicationId,
        contentEntryId: 'content-entry-1',
        createdAt: recordedAt,
        currentRevisionId: 'content-revision-2',
        id: 'cv-link-1',
        previewToken: 'preview-token-1',
        publicUrl: 'https://cv.example.test/cv/public-token-1',
        token: 'public-token-1',
        updatedAt: recordedAt,
      })

      const firstArtifact = artifact()
      yield* artifacts.persistPending(firstArtifact, outbox(firstArtifact))
      const failed = yield* artifacts.markFailed(
        'pdf-artifact-1',
        'render_failed',
        'Browser failed.',
        '2026-07-17T15:00:00.000Z'
      )
      const retryArtifact = artifact({
        id: 'pdf-artifact-2',
        requestId: 'request-2',
      })
      yield* artifacts.persistPending(retryArtifact, outbox(retryArtifact))
      const duplicate = artifact({
        id: 'pdf-artifact-duplicate',
        requestId: 'request-2',
      })
      yield* artifacts.persistPending(duplicate, outbox(duplicate))
      const pendingDispatch = yield* artifacts.findPendingDispatch(
        retryArtifact.id
      )
      yield* artifacts.markDispatchFailed(
        retryArtifact.id,
        'Queue temporarily unavailable.',
        '2026-07-17T15:30:00.000Z'
      )
      const failedDispatch = yield* artifacts.findPendingDispatch(
        retryArtifact.id
      )
      yield* artifacts.markDispatched(
        retryArtifact.id,
        '2026-07-17T15:31:00.000Z'
      )
      const dispatched = yield* artifacts.findPendingDispatch(retryArtifact.id)
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
        failedDispatch,
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
        pendingDispatch,
        ready,
        dispatched,
        retryByRequest: yield* artifacts.findByRequestId('request-2'),
        restoredLink: yield* links.findByEntry('content-entry-1'),
      }
    })
  )

  assert.equal(result.ready, true)
  assert.equal(result.failed, true)
  assert.equal(result.disabled, true)
  assert.equal(result.enabled, true)
  assert.equal(result.pendingDispatch?.artifactId, 'pdf-artifact-2')
  assert.equal(result.pendingDispatch?.attempts, 0)
  assert.equal(result.failedDispatch?.attempts, 1)
  assert.equal(
    result.failedDispatch?.lastError,
    'Queue temporarily unavailable.'
  )
  assert.equal(result.dispatched, undefined)
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
  assert.equal(result.retryByRequest?.id, 'pdf-artifact-2')
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
      const links = yield* CvLinksCrud
      const snapshots = yield* JobPostingSnapshotsCrud

      yield* seedApplication
      yield* snapshots.persist({
        applicationId: application.applicationId,
        errorCode: null,
        errorMessage: null,
        fetchedAt: recordedAt,
        fetcherVersion: 'fetcher-v1',
        finalUrl: application.postingUrl,
        id: 'job-snapshot-1',
        normalizedByteLength: 100,
        normalizedMediaType: 'text/plain',
        normalizedObjectKey: 'sha256/job-normalized',
        normalizedSha256: 'job-normalized',
        rawByteLength: 200,
        rawMediaType: 'text/html',
        rawObjectKey: 'sha256/job-raw',
        rawSha256: 'job-raw',
        requestedUrl: application.postingUrl,
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
      yield* links.stage({
        applicationId: application.applicationId,
        contentEntryId: 'content-entry-1',
        createdAt: recordedAt,
        currentRevisionId: 'content-revision-1',
        id: 'cv-link-1',
        previewToken: 'preview-token-1',
        publicUrl: 'https://cv.example.test/c/public-token-1',
        token: 'public-token-1',
        updatedAt: recordedAt,
      })
      const pendingArtifact = artifact({
        contentRevisionId: 'content-revision-1',
      })
      yield* artifacts.persistPending(pendingArtifact, outbox(pendingArtifact))

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

  const outboxRows = await harness.query<{ count: number }>(
    `select count(*) as count
       from pdf_generation_outbox where artifact_id = 'pdf-artifact-1'`
  )
  assert.deepEqual(outboxRows, [{ count: 0 }])
})
