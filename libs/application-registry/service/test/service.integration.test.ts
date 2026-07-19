import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import type { D1Database } from '@cloudflare/workers-types'
import { makeInMemoryArtifactStoreLayer } from '@cv/application-registry-artifact-store/test-support'
import { makeRegistryCrudLive } from '@cv/application-registry-crud/live'
import { FxRates } from '@cv/application-registry-fx'
import { ListingAvailabilityChecker } from '@cv/application-registry-listing-check'
import { RegistryMiniflareHarness } from '@cv/worker-test-kit/application-registry'
import { Effect, Layer, ManagedRuntime, Result } from 'effect'

import {
  ActivitiesService,
  AnnotationsService,
  ApplicationsService,
  ContentEntriesService,
  type CreateApplicationInput,
  CvAnalyticsTrafficSource,
} from '../src'
import { RegistryServicesLive } from '../src/live'

const recordedAt = '2026-07-12T12:00:00.000Z'

const FakeFxRatesLive = Layer.succeed(FxRates, {
  get: (baseCurrency, quoteCurrency) =>
    Effect.succeed({
      baseCurrency,
      fetchedAt: recordedAt,
      observedAt: recordedAt,
      provider: 'service-integration',
      quoteCurrency,
      rate: 2,
    }),
})

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
    read: (_aliases, range) =>
      Effect.succeed({
        generatedAt: recordedAt,
        range: { ...range, granularity: 'day' },
        records: [],
      }),
  }
)

const makeRegistryServiceTestRuntime = (database: D1Database) =>
  ManagedRuntime.make(
    RegistryServicesLive.pipe(
      Layer.provide(makeRegistryCrudLive(Effect.succeed(database))),
      Layer.provide(makeInMemoryArtifactStoreLayer()),
      Layer.provide(FakeFxRatesLive),
      Layer.provide(FakeListingAvailabilityCheckerLive),
      Layer.provide(FakeCvAnalyticsTrafficSourceLive)
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

let harness: RegistryMiniflareHarness
let runtime: ReturnType<typeof makeRegistryServiceTestRuntime>

before(async () => {
  harness = await RegistryMiniflareHarness.make({
    databaseBinding: 'APPLICATION_REGISTRY_DB',
  })
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
