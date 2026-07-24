import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { makeInMemoryArtifactStoreLayer } from '@cv/application-registry-artifact-store/test-support'
import {
  makeRegistryCrudLive,
  type RegistryDatabaseShape,
} from '@cv/application-registry-crud/live'
import {
  RegistryEventPublisherNoop,
  RegistryEventSchema,
} from '@cv/application-registry-events'
import { ListingAvailabilityChecker } from '@cv/application-registry-listing-check'
import { Effect, Layer, ManagedRuntime, Result } from 'effect'

import { RegistryPostgresHarness } from '../../crud/test/postgres-harness.ts'

import {
  ActivitiesService,
  AnnotationsService,
  ApplicationArtifactsService,
  ApplicationsService,
  ContentEntriesService,
  type CreateApplicationInput,
  CvAnalyticsTrafficSource,
  CvPublicationConfiguration,
  CvPublicationsService,
  OpaqueObjectsService,
  PdfArtifactsService,
  ScheduledListingChecksRunner,
} from '../src'
import {
  RegistryServicesLive,
  ScheduledListingChecksRunnerLive,
} from '../src/live'

const recordedAt = '2026-07-12T12:00:00.000Z'

const FakeListingAvailabilityCheckerLive = Layer.succeed(
  ListingAvailabilityChecker,
  {
    check: (target) =>
      Effect.succeed({
        checkedAt: recordedAt,
        checkerVersion: 'service-integration',
        confidence: 'high',
        contentHash: null,
        evidence: [],
        finalUrl: target.url,
        httpStatus: 200,
        outcome: 'open',
        provider: 'test',
        reasonCode: 'provider_open',
        requestedUrl: target.url,
      }),
  }
)

const FakeCvAnalyticsTrafficSourceLive = Layer.succeed(
  CvAnalyticsTrafficSource,
  {
    capabilities: () =>
      Effect.succeed({ retentionMs: 31 * 24 * 60 * 60 * 1_000 }),
    read: (_aliases, range) =>
      Effect.succeed({
        generatedAt: recordedAt,
        range: { ...range, granularity: 'day' },
        records: [],
      }),
  }
)

const makeRegistryServiceTestRuntime = (database: RegistryDatabaseShape) =>
  ManagedRuntime.make(
    RegistryServicesLive.pipe(
      Layer.provide(makeRegistryCrudLive(database)),
      Layer.provide(makeInMemoryArtifactStoreLayer()),
      Layer.provide(RegistryEventPublisherNoop),
      Layer.provide(FakeCvAnalyticsTrafficSourceLive),
      Layer.provide(
        Layer.succeed(
          CvPublicationConfiguration,
          CvPublicationConfiguration.of({
            publicBaseUrl: new URL('https://cv.example.test/c/'),
          })
        )
      )
    )
  )

const applicationInput = (suffix: string): CreateApplicationInput => ({
  postingUrl: `https://example.test/jobs/${suffix}`,
  company: 'Service Integration',
  role: 'Effect Engineer',
  location: 'Remote',
  applicationStatus: 'not_started',
  targetStage: 'apply_next',
  personalPriority: null,
  followUpAt: null,
  appliedAt: null,
  labels: ['seed'],
})

const makeScheduledRunnerTestRuntime = (database: RegistryDatabaseShape) =>
  ManagedRuntime.make(
    ScheduledListingChecksRunnerLive.pipe(
      Layer.provide(makeRegistryCrudLive(database)),
      Layer.provide(FakeListingAvailabilityCheckerLive),
      Layer.provide(RegistryEventPublisherNoop)
    )
  )

let harness: RegistryPostgresHarness
let runtime: ReturnType<typeof makeRegistryServiceTestRuntime>

before(async () => {
  harness = await RegistryPostgresHarness.make()
})

beforeEach(() => {
  runtime = makeRegistryServiceTestRuntime(harness.database)
})

afterEach(async () => {
  await runtime.dispose()
  await harness.reset()
})

after(async () => {
  await harness.dispose()
})

test('creates and updates applications while issuing read-only activities', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const activities = yield* ActivitiesService
      const created = yield* applications.create(applicationInput('platform'))
      const duplicate = yield* Effect.result(
        applications.create({
          ...applicationInput('duplicate'),
          postingUrl:
            'https://example.test/jobs/platform?utm_source=integration#apply',
        })
      )
      const updateRequest = {
        applicationStatus: 'applied' as const,
        expectedVersion: created.version,
        idempotencyKey: 'application-update-1',
      }
      const updated = yield* applications.update(created.id, updateRequest)
      const replayed = yield* applications.update(created.id, updateRequest)
      const applicationActivities = yield* activities.listByApplication(
        created.id
      )
      const statusActivities = yield* activities.list({
        filters: [
          {
            type: 'condition',
            field: 'kind',
            operator: 'eq',
            value: 'status_changed',
          },
        ],
        pagination: { size: 20 },
      })
      const listed = yield* applications.list({
        filters: [
          {
            type: 'condition',
            field: 'postingUrl',
            operator: 'eq',
            value: created.postingUrl,
          },
        ],
        pagination: { size: 20 },
      })
      return {
        applicationActivities,
        created,
        duplicate,
        listed,
        replayed,
        statusActivities,
        updated,
      }
    })
  )

  assert.match(result.created.id, /^[0-9a-f-]{36}$/u)
  assert.equal(result.created.version, 1)
  assert.equal(Result.isFailure(result.duplicate), true)
  if (Result.isFailure(result.duplicate)) {
    assert.equal(result.duplicate.failure._tag, 'RegistryConflictError')
  }
  assert.equal(result.updated.application.applicationStatus, 'applied')
  assert.equal(result.updated.application.version, 2)
  assert.equal(typeof result.updated.application.appliedAt, 'string')
  assert.deepEqual(result.replayed, result.updated)
  assert.deepEqual(
    result.applicationActivities.items.map(({ kind, source }) => ({
      kind,
      source,
    })),
    [
      { kind: 'application_created', source: 'management' },
      { kind: 'status_changed', source: 'management' },
    ]
  )
  assert.deepEqual(
    result.statusActivities.items.map(({ applicationId, kind }) => ({
      applicationId,
      kind,
    })),
    [{ applicationId: result.created.id, kind: 'status_changed' }]
  )
  assert.deepEqual(
    result.listed.items.map(({ id }) => id),
    [result.created.id]
  )
})

test('runs scheduled listing checks through the separate one-shot service', async () => {
  const created = await runtime.runPromise(
    ApplicationsService.pipe(
      Effect.flatMap((applications) =>
        applications.create(applicationInput('scheduled-runner'))
      )
    )
  )
  const scheduledRuntime = makeScheduledRunnerTestRuntime(harness.database)

  try {
    const first = await scheduledRuntime.runPromise(
      ScheduledListingChecksRunner.pipe(
        Effect.flatMap((runner) =>
          runner.runOnce({ limit: 5, mode: 'archive_eligible' })
        )
      )
    )
    const second = await scheduledRuntime.runPromise(
      ScheduledListingChecksRunner.pipe(
        Effect.flatMap((runner) =>
          runner.runOnce({ limit: 5, mode: 'archive_eligible' })
        )
      )
    )

    assert.equal(first.run?.state, 'completed')
    assert.equal(first.run?.selectedCount, 1)
    assert.equal(first.checks.at(0)?.applicationId, created.id)
    assert.equal(second.run, null)
    assert.deepEqual(second.checks, [])
  } finally {
    await scheduledRuntime.dispose()
  }
})

test('persists notes idempotently and issues their activity on the backend', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const annotations = yield* AnnotationsService
      const activities = yield* ActivitiesService
      const application = yield* applications.create(applicationInput('notes'))
      const request = {
        body: 'Follow up after the technical screen.',
        kind: 'general' as const,
        source: 'management',
        idempotencyKey: 'note-1',
      }
      const first = yield* annotations.addNote(application.id, request)
      const replay = yield* annotations.addNote(application.id, request)
      const stored = yield* annotations.list(application.id)
      const history = yield* activities.listByApplication(application.id)
      return { first, history, replay, stored }
    })
  )

  assert.equal(result.first.replayed, false)
  assert.equal(result.replay.replayed, true)
  assert.equal(result.replay.note.id, result.first.note.id)
  assert.deepEqual(
    result.stored.notes.map(({ id }) => id),
    [result.first.note.id]
  )
  assert.deepEqual(
    result.history.items.map(({ kind }) => kind),
    ['application_created', 'note_added']
  )
})

test('attaches multiple uploaded artifacts independently of content workflows', async () => {
  const resumeBytes = new TextEncoder().encode('%PDF uploaded resume')
  const coverLetterBytes = new TextEncoder().encode(
    'Uploaded cover letter text'
  )
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const artifacts = yield* ApplicationArtifactsService
      const objects = yield* OpaqueObjectsService
      const application = yield* applications.create(
        applicationInput('artifacts')
      )
      const otherApplication = yield* applications.create(
        applicationInput('other-artifacts')
      )
      const resumeBlob = yield* objects.put(resumeBytes)
      const coverLetterBlob = yield* objects.put(coverLetterBytes)
      const resumeRequest = {
        category: 'resume' as const,
        filename: 'resume.pdf',
        locale: 'en',
        mediaType: 'application/pdf',
        operationId: 'artifact-resume-1',
        sha256: resumeBlob.sha256,
      }
      const first = yield* artifacts.create(application.id, resumeRequest)
      const replay = yield* artifacts.create(application.id, resumeRequest)
      const second = yield* artifacts.create(application.id, {
        category: 'cover_letter',
        filename: 'cover-letter.txt',
        mediaType: 'text/plain',
        operationId: 'artifact-cover-letter-1',
        sha256: coverLetterBlob.sha256,
      })
      const listed = yield* artifacts.list(application.id)
      const found = yield* artifacts.find(application.id, first.artifact.id)
      const downloaded = yield* artifacts.read(
        application.id,
        first.artifact.id
      )
      const crossApplicationRead = yield* Effect.result(
        artifacts.read(otherApplication.id, first.artifact.id)
      )

      return {
        crossApplicationRead,
        downloaded,
        first,
        found,
        listed,
        replay,
        second,
      }
    })
  )

  assert.equal(result.first.replayed, false)
  assert.equal(result.replay.replayed, true)
  assert.equal(result.replay.artifact.id, result.first.artifact.id)
  assert.equal(result.first.artifact.source, 'uploaded')
  assert.equal(result.first.artifact.generatedArtifactId, null)
  assert.equal(result.first.artifact.contentRevisionId, null)
  assert.equal(result.found.id, result.first.artifact.id)
  assert.deepEqual(result.downloaded.bytes, resumeBytes)
  assert.equal(result.downloaded.artifact.id, result.first.artifact.id)
  assert.equal(result.listed.length, 2)
  assert.deepEqual(result.listed.map(({ filename }) => filename).toSorted(), [
    'cover-letter.txt',
    'resume.pdf',
  ])
  assert.notEqual(result.second.artifact.id, result.first.artifact.id)
  assert.equal(Result.isFailure(result.crossApplicationRead), true)
  if (Result.isFailure(result.crossApplicationRead)) {
    assert.equal(
      result.crossApplicationRead.failure._tag,
      'RegistryNotFoundError'
    )
  }
})

test('keeps content payloads as exact opaque bytes across revision history', async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ sections: [{ type: 'summary', value: 'Exact bytes' }] })
  )
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const content = yield* ContentEntriesService
      const application = yield* applications.create(
        applicationInput('content')
      )
      const entry = yield* content.ensure(application.id, {
        kind: 'cv',
        locale: 'en',
      })
      const request = {
        contractId: '@cv/contracts/cv-document',
        contractVersion: '1',
        expectedVersion: entry.version,
        operationId: 'revision-1',
        payload: { bytes, mediaType: 'application/json' },
        source: 'ai' as const,
      }
      const appended = yield* content.appendRevision(
        application.id,
        entry.id,
        request
      )
      const replayed = yield* content.appendRevision(
        application.id,
        entry.id,
        request
      )
      const loaded = yield* content.readRevision(
        application.id,
        entry.id,
        appended.revision.id
      )
      const approved = yield* content.approveRevision(
        application.id,
        entry.id,
        {
          expectedVersion: appended.entry.version,
          revisionId: appended.revision.id,
        }
      )
      return { appended, approved, loaded, replayed }
    })
  )

  assert.equal(result.appended.revision.revisionNumber, 1)
  assert.equal(result.replayed.revision.id, result.appended.revision.id)
  assert.deepEqual(result.loaded.bytes, bytes)
  assert.equal(result.approved.entry.state, 'approved')
  assert.equal(
    result.approved.entry.approvedRevisionId,
    result.appended.revision.id
  )
})

test('restores a rejection-disabled publication only after its current PDF is ready', async () => {
  const pdf = new TextEncoder().encode('%PDF ready after rejection')
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const content = yield* ContentEntriesService
      const artifacts = yield* ApplicationArtifactsService
      const publications = yield* CvPublicationsService
      const pdfs = yield* PdfArtifactsService
      const application = yield* applications.create(
        applicationInput('publication-restore')
      )
      const entry = yield* content.ensure(application.id, {
        kind: 'cv',
        locale: 'en',
      })
      const appended = yield* content.appendRevision(application.id, entry.id, {
        contractId: '@cv/contracts/cv-document',
        contractVersion: '1',
        expectedVersion: entry.version,
        operationId: 'publication-restore-revision',
        payload: {
          bytes: new TextEncoder().encode('{"publication":"restore"}'),
          mediaType: 'application/json',
        },
        source: 'human',
      })
      const approved = yield* content.approveRevision(
        application.id,
        entry.id,
        {
          expectedVersion: appended.entry.version,
          revisionId: appended.revision.id,
        }
      )
      const staged = yield* publications.stage(application.id, entry.id, {
        operationId: crypto.randomUUID(),
        expectedContentVersion: approved.entry.version,
        revisionId: appended.revision.id,
      })
      yield* publications.setAvailability(application.id, entry.id, {
        operationId: crypto.randomUUID(),
        enabled: true,
        expectedPublicationVersion: staged.publicationVersion,
      })
      const pending = yield* pdfs.ensureAttempt(
        RegistryEventSchema.cases.PdfGenerationRequested.make({
          applicationId: application.id,
          contentEntryId: entry.id,
          contentRevisionId: staged.currentRevisionId,
          correlationId: 'publication-restore-pdf',
          cvLinkId: staged.id,
          eventId: 'publication-restore-pdf',
          occurredAt: staged.updatedAt,
          publicationVersion: staged.publicationVersion,
          version: 1,
        })
      )

      const rejected = yield* applications.update(application.id, {
        applicationStatus: 'rejected',
        expectedVersion: application.version,
        idempotencyKey: 'publication-rejected',
      })
      yield* publications.disableForApplication(
        application.id,
        'application_rejected',
        'publication-rejected'
      )
      const reopened = yield* applications.update(application.id, {
        applicationStatus: 'preparing',
        expectedVersion: rejected.application.version,
        idempotencyKey: 'publication-reopened',
      })
      const restoredWhilePending = yield* publications.restoreAfterRejection(
        application.id,
        'publication-reopened-pending'
      )
      const linkWhilePending = yield* publications.findByEntry(
        application.id,
        entry.id
      )

      const ready = yield* pdfs.complete(
        application.id,
        pending.id,
        'renderer-v1',
        pdf
      )
      const restoredWhenReady = yield* publications.restoreAfterRejection(
        application.id,
        'publication-reopened-ready'
      )
      const restoredLink = yield* publications.findByEntry(
        application.id,
        entry.id
      )
      const applicationArtifacts = yield* artifacts.list(application.id)
      return {
        applicationArtifacts,
        linkWhilePending,
        ready,
        reopened,
        restoredLink,
        restoredWhenReady,
        restoredWhilePending,
      }
    })
  )

  assert.equal(result.reopened.application.applicationStatus, 'preparing')
  assert.equal(result.restoredWhilePending, 0)
  assert.equal(result.linkWhilePending.enabled, false)
  assert.equal(result.ready.status, 'ready')
  assert.deepEqual(
    result.applicationArtifacts.map(
      ({ category, generatedArtifactId, mediaType, source }) => ({
        category,
        generatedArtifactId,
        mediaType,
        source,
      })
    ),
    [
      {
        category: 'resume',
        generatedArtifactId: result.ready.id,
        mediaType: 'application/pdf',
        source: 'generated',
      },
    ]
  )
  assert.equal(result.restoredWhenReady, 1)
  assert.equal(result.restoredLink.enabled, true)
})
