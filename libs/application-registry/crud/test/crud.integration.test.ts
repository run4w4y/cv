import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import {
  applicationActivities as applicationActivityTable,
  applications as applicationTable,
  registrySequence,
} from '@cv/application-registry-entity'
import {
  activityListQuery,
  applicationListQuery,
} from '@cv/application-registry-entity/query'
import { Effect } from 'effect'
import { isSqlError } from 'effect/unstable/sql/SqlError'

import {
  ActivitiesCrud,
  AnnotationsCrud,
  ApplicationsCrud,
  CompensationsCrud,
  ListingChecksCrud,
  type PersistedApplication,
  type PersistedListingCheck,
  type PersistedNote,
} from '../src'
import { makeRegistryCrudLive } from '../src/live'
import { RegistryPostgresHarness } from './postgres-harness'

let harness: RegistryPostgresHarness

const recordedAt = '2026-07-12T12:00:00.000Z'

const resolveApplicationList = (
  request: Parameters<typeof applicationListQuery.resolve>[0]
) => applicationListQuery.resolve(request)

const resolveActivityList = (
  request: Parameters<typeof activityListQuery.resolve>[0]
) => activityListQuery.resolve(request)

const application: PersistedApplication = {
  activity: {
    activityId: 'crud-application-created',
    actor: 'system',
    kind: 'application_created',
    occurredAt: recordedAt,
    payload: {},
    source: 'migration',
  },
  applicationId: 'crud-application-1',
  company: 'CRUD Test',
  location: null,
  postingFingerprint: 'https://example.test/jobs/crud-1',
  postingUrl: 'https://example.test/jobs/crud-1',
  postingUrlNormalized: 'https://example.test/jobs/crud-1',
  recordedAt,
  role: 'Database Engineer',
}

const note = (noteId: string): PersistedNote => ({
  activityId: `activity-${noteId}`,
  body: `Note ${noteId}`,
  idempotencyKey: 'crud-note-operation',
  kind: 'general',
  noteId,
  recordedAt,
  requestHash: 'crud-note-signature',
  source: 'crud-test',
})

const listingCheck = (
  overrides: Partial<PersistedListingCheck> = {}
): PersistedListingCheck => ({
  applicationId: application.applicationId,
  archiveApplication: false,
  checkedAt: recordedAt,
  checkerVersion: '1',
  closedCandidateAt: null,
  confidence: 'high',
  consecutiveClosedChecks: 0,
  contentHash: null,
  activityId: null,
  evidence: [],
  expectedVersion: 1,
  finalUrl: application.postingUrl,
  httpStatus: 200,
  id: 'listing-check-default',
  listingAvailability: 'open',
  nextCheckAt: '2026-07-13T12:00:00.000Z',
  operationId: 'listing-check-operation-default',
  outcome: 'open',
  provider: 'example.test',
  reasonCode: 'provider_open',
  receivedAt: recordedAt,
  recommendedAction: 'keep',
  recordedAt,
  requestHash: 'listing-check-signature-default',
  requestedUrl: application.postingUrl,
  runId: null,
  ...overrides,
})

const runCrud = <A, E>(
  program: Effect.Effect<
    A,
    E,
    | AnnotationsCrud
    | ActivitiesCrud
    | ApplicationsCrud
    | CompensationsCrud
    | ListingChecksCrud
  >
) =>
  Effect.runPromise(
    program.pipe(Effect.provide(makeRegistryCrudLive(harness.database)))
  )

const seedApplication = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  yield* applications.persist(application, {
    operation: 'CRUD integration application seed',
  })
  return yield* applications.findByIdentifier(application.applicationId)
})

before(async () => {
  harness = await RegistryPostgresHarness.make()
})

afterEach(async () => {
  await harness.reset()
})

after(async () => {
  await harness.dispose()
})

test('persists applications with database defaults through slice services', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const created = yield* seedApplication
      const page = yield* applications.list(
        resolveApplicationList({ pagination: { size: 10 } })
      )
      return { created, page }
    })
  )

  assert.ok(result.created)
  assert.equal(result.created.id, 'crud-application-1')
  assert.equal(result.created.applicationStatus, 'not_started')
  assert.equal(result.created.createdAt, recordedAt)
  assert.equal(result.created.targetStage, 'backlog')
  assert.equal(result.created.version, 1)

  assert.deepEqual(
    result.page.items.map(({ id }) => id),
    ['crud-application-1']
  )
  assert.equal(result.page.pageInfo.hasNextPage, false)
})

test('updates a managed application aggregate in one version transition', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const annotations = yield* AnnotationsCrud
      const applications = yield* ApplicationsCrud
      const compensations = yield* CompensationsCrud
      const activities = yield* ActivitiesCrud
      yield* applications.persist(
        {
          ...application,
          compensations: [
            {
              currencyCode: 'USD',
              id: 'managed-annual-original',
              kind: 'base_salary',
              maximumMinor: 15_000_000,
              minimumMinor: 12_000_000,
              period: 'year',
              rawText: null,
              source: 'seed',
            },
          ],
          labels: ['original'],
        },
        { operation: 'managed update seed' }
      )

      const updated = yield* applications.updateManaged(
        application.applicationId,
        {
          annualCompensation: {
            replacement: {
              currencyCode: 'EUR',
              id: 'managed-annual-replacement',
              kind: 'base_salary',
              maximumMinor: 18_000_000,
              minimumMinor: 16_000_000,
              rawText: null,
              source: 'manual',
            },
          },
          activity: {
            activityId: 'managed-status-activity',
            actor: 'user',
            kind: 'status_changed',
            occurredAt: '2026-07-12T13:00:00.000Z',
            payload: {
              previousApplicationStatus: 'not_started',
              nextApplicationStatus: 'applied',
            },
            source: 'management',
          },
          expectedVersion: 1,
          idempotencyKey: 'managed-operation',
          labels: ['remote', 'priority', 'remote'],
          patch: {
            applicationStatus: 'applied',
            company: 'Managed Company',
            personalPriority: 'high',
          },
          recordedAt: '2026-07-12T13:00:00.000Z',
          requestHash: 'managed-signature',
        }
      )
      const stale = yield* applications.updateManaged(
        application.applicationId,
        {
          annualCompensation: {
            replacement: null,
          },
          activity: {
            activityId: 'managed-stale-activity',
            actor: 'user',
            kind: 'details_changed',
            occurredAt: '2026-07-12T14:00:00.000Z',
            payload: {},
            source: 'management',
          },
          expectedVersion: 1,
          idempotencyKey: 'managed-operation-stale',
          labels: ['stale'],
          patch: { personalPriority: 'low' },
          recordedAt: '2026-07-12T14:00:00.000Z',
          requestHash: 'managed-signature-stale',
        }
      )

      return {
        annotations: yield* annotations.listLabels(application.applicationId),
        application: yield* applications.findByIdentifier(
          application.applicationId
        ),
        compensations: yield* compensations.listByApplication(
          application.applicationId
        ),
        activities: yield* activities.listByApplication(
          application.applicationId
        ),
        stale,
        updated,
      }
    })
  )

  assert.equal(result.updated, true)
  assert.equal(result.stale, false)
  assert.equal(result.application?.applicationStatus, 'applied')
  assert.equal(result.application?.company, 'Managed Company')
  assert.equal(result.application?.personalPriority, 'high')
  assert.equal(result.application?.version, 2)
  assert.equal(result.application?.updatedRevision, 2)
  assert.deepEqual(
    result.annotations.map(({ label }) => label),
    ['priority', 'remote']
  )
  assert.deepEqual(
    result.compensations.map(
      ({ currencyCode, id, maximumMinor, minimumMinor }) => ({
        currencyCode,
        id,
        maximumMinor,
        minimumMinor,
      })
    ),
    [
      {
        currencyCode: 'EUR',
        id: 'managed-annual-replacement',
        maximumMinor: 18_000_000,
        minimumMinor: 16_000_000,
      },
    ]
  )
  assert.deepEqual(
    result.activities.map(({ kind, revision }) => ({
      kind,
      revision,
    })),
    [
      { kind: 'application_created', revision: 1 },
      { kind: 'status_changed', revision: 2 },
    ]
  )
})

test('filters before pagination and returns dashboard details and facets', async () => {
  const pastFollowUp: PersistedApplication = {
    ...application,
    activity: {
      ...application.activity,
      activityId: 'crud-dashboard-past-created',
    },
    applicationId: 'crud-dashboard-past',
    applicationStatus: 'applied',
    company: 'Alpha Corp',
    compensations: [
      {
        currencyCode: 'USD',
        id: 'crud-dashboard-compensation',
        kind: 'base_salary',
        maximumMinor: 15_000_000,
        minimumMinor: 12_000_000,
        period: 'year',
        rawText: null,
        source: 'crud-test',
      },
    ],
    followUpAt: '2026-07-12T11:00:00.000Z',
    labels: ['remote', 'priority'],
    location: 'Remote',
    personalPriority: 'high',
    postingFingerprint: 'https://example.test/jobs/dashboard-past',
    postingUrl: 'https://example.test/jobs/dashboard-past',
    postingUrlNormalized: 'https://example.test/jobs/dashboard-past',
    role: 'Platform Engineer',
    targetStage: 'apply_next',
  }
  const futureFollowUp: PersistedApplication = {
    ...application,
    activity: {
      ...application.activity,
      activityId: 'crud-dashboard-future-created',
    },
    applicationId: 'crud-dashboard-future',
    applicationStatus: 'preparing',
    company: 'Beta Corp',
    followUpAt: '2026-07-12T13:00:00.000Z',
    labels: ['remote'],
    personalPriority: 'low',
    postingFingerprint: 'https://example.test/jobs/dashboard-future',
    postingUrl: 'https://example.test/jobs/dashboard-future',
    postingUrlNormalized: 'https://example.test/jobs/dashboard-future',
    targetStage: 'backlog',
  }

  const result = await runCrud(
    Effect.gen(function* () {
      const annotations = yield* AnnotationsCrud
      const applications = yield* ApplicationsCrud
      yield* applications.persist(pastFollowUp, {
        operation: 'dashboard past seed',
      })
      yield* applications.persist(futureFollowUp, {
        operation: 'dashboard future seed',
      })
      yield* annotations.persistNote(
        pastFollowUp.applicationId,
        note('crud-dashboard-note')
      )

      const page = yield* applications.list(
        resolveApplicationList({
          filters: [
            {
              type: 'condition',
              field: 'applicationStatus',
              operator: 'in',
              value: ['applied'],
            },
            {
              type: 'condition',
              field: 'company',
              operator: 'contains',
              value: 'alpha',
            },
            {
              type: 'condition',
              field: 'followUpAt',
              operator: 'lt',
              value: recordedAt,
            },
            {
              type: 'condition',
              field: 'labels',
              operator: 'hasAny',
              value: ['remote'],
            },
            {
              type: 'condition',
              field: 'location',
              operator: 'contains',
              value: 'remote',
            },
            {
              type: 'condition',
              field: 'personalPriority',
              operator: 'in',
              value: ['high'],
            },
            {
              type: 'condition',
              field: 'role',
              operator: 'contains',
              value: 'platform',
            },
            {
              type: 'condition',
              field: 'targetStage',
              operator: 'in',
              value: ['apply_next'],
            },
          ],
          pagination: { size: 10 },
        })
      )
      const upcoming = yield* applications.list(
        resolveApplicationList({
          filters: [
            {
              type: 'condition',
              field: 'followUpAt',
              operator: 'gte',
              value: recordedAt,
            },
          ],
          pagination: { size: 10 },
        })
      )
      const facets = yield* applications.facets()
      return { facets, page, upcoming }
    })
  )

  assert.deepEqual(
    result.page.items.map(({ id }) => id),
    [pastFollowUp.applicationId]
  )
  assert.deepEqual(result.page.items[0]?.labels, ['priority', 'remote'])
  assert.deepEqual(result.page.items[0]?.compensations, [
    {
      applicationId: pastFollowUp.applicationId,
      createdAt: recordedAt,
      currencyCode: 'USD',
      id: 'crud-dashboard-compensation',
      kind: 'base_salary',
      maximumMinor: 15_000_000,
      minimumMinor: 12_000_000,
      period: 'year',
      rawText: null,
      source: 'crud-test',
      updatedAt: recordedAt,
    },
  ])
  assert.deepEqual(result.page.items[0]?.counts, { notes: 1 })
  assert.deepEqual(result.page.items[0]?.latestActivity, {
    kind: 'note_added',
    occurredAt: recordedAt,
  })
  assert.deepEqual(
    result.upcoming.items.map(({ id }) => id),
    [futureFollowUp.applicationId]
  )
  assert.deepEqual(result.facets, {
    companies: ['Alpha Corp', 'Beta Corp'],
    labels: ['priority', 'remote'],
  })
})

const seedPaginationGraph = async (itemCount: number) => {
  const applications = Array.from({ length: itemCount }, (_, index) => {
    const sequence = index + 1
    const id = `pagination-application-${sequence.toString().padStart(3, '0')}`
    const timestamp = new Date(
      Date.parse(recordedAt) + sequence * 1_000
    ).toISOString()
    const postingUrl = `https://example.test/jobs/${id}`
    return {
      applicationStatus: 'not_started' as const,
      company: `Pagination Company ${sequence}`,
      createdAt: timestamp,
      id,
      location: null,
      postingFingerprint: postingUrl,
      postingUrl,
      postingUrlNormalized: postingUrl,
      role: `Pagination Role ${sequence}`,
      targetStage: 'backlog' as const,
      updatedAt: timestamp,
      updatedRevision: sequence,
    }
  })
  const activities = applications.map((application, index) => ({
    actor: 'system' as const,
    applicationId: application.id,
    id: `pagination-activity-${(index + 1).toString().padStart(3, '0')}`,
    kind: 'details_changed' as const,
    occurredAt: application.createdAt,
    payload: { index },
    revision: index + 1,
    source: 'migration' as const,
  }))

  await Effect.runPromise(
    Effect.gen(function* () {
      yield* harness.database.insert(applicationTable).values(applications)
      yield* harness.database
        .insert(applicationActivityTable)
        .values(activities)
      yield* harness.database
        .insert(registrySequence)
        .values({ id: 1, revision: itemCount })
    })
  )
}

test('paginates every application and activity with numeric page sizes', async () => {
  const itemCount = 101
  await seedPaginationGraph(itemCount)

  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const activities = yield* ActivitiesCrud
      const firstApplicationPage = yield* applications.list(
        resolveApplicationList({ pagination: { size: 100 } })
      )
      const secondApplicationPage = yield* applications.list(
        resolveApplicationList({
          pagination: {
            after: firstApplicationPage.pageInfo.nextCursor ?? undefined,
            size: 100,
          },
        })
      )
      const firstActivityPage = yield* activities.list(
        resolveActivityList({ pagination: { size: 100 } })
      )
      const secondActivityPage = yield* activities.list(
        resolveActivityList({
          pagination: {
            after: firstActivityPage.pageInfo.nextCursor ?? undefined,
            size: 100,
          },
        })
      )
      return {
        firstApplicationPage,
        firstActivityPage,
        secondApplicationPage,
        secondActivityPage,
      }
    })
  )

  assert.equal(result.firstApplicationPage.items.length, 100)
  assert.equal(result.firstApplicationPage.pageInfo.hasNextPage, true)
  assert.equal(
    result.firstApplicationPage.items[0]?.latestActivity?.kind,
    'details_changed'
  )
  assert.equal(result.secondApplicationPage.items.length, 1)
  assert.equal(result.secondApplicationPage.pageInfo.hasNextPage, false)
  assert.equal(result.firstActivityPage.items.length, 100)
  assert.equal(result.firstActivityPage.pageInfo.hasNextPage, true)
  assert.equal(result.secondActivityPage.items.length, 1)
  assert.equal(result.secondActivityPage.pageInfo.hasNextPage, false)
})

test('rolls back an atomic note write when its operation receipt conflicts', async () => {
  await runCrud(
    Effect.gen(function* () {
      const annotations = yield* AnnotationsCrud
      yield* seedApplication
      yield* annotations.persistNote(
        application.applicationId,
        note('crud-note-1')
      )
    })
  )

  await assert.rejects(() =>
    runCrud(
      Effect.gen(function* () {
        const annotations = yield* AnnotationsCrud
        yield* annotations.persistNote(
          application.applicationId,
          note('crud-note-2')
        )
      })
    )
  )

  const notes = await harness.query<{ id: string }>(
    'select id from application_notes order by id'
  )
  assert.deepEqual(notes, [{ id: 'crud-note-1' }])
})

test('claims, records, and archives listing checks through PostgreSQL', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const checks = yield* ListingChecksCrud
      yield* seedApplication
      yield* checks.startRun({
        id: 'listing-run-1',
        mode: 'archive_eligible',
        selectedCount: 1,
        startedAt: recordedAt,
        trigger: 'scheduled',
      })
      yield* checks.ensureEligibleSchedules(recordedAt)
      const claimed = yield* checks.claimDue({
        leaseToken: 'listing-run-1',
        leaseUntil: '2099-07-12T12:20:00.000Z',
        limit: 10,
        now: recordedAt,
      })
      const firstApplied = yield* checks.persist({
        applicationId: application.applicationId,
        archiveApplication: false,
        checkedAt: recordedAt,
        checkerVersion: '1',
        claimedLeaseToken: 'listing-run-1',
        closedCandidateAt: recordedAt,
        confidence: 'high',
        consecutiveClosedChecks: 1,
        contentHash: null,
        activityId: null,
        evidence: [
          { code: 'http_status', detail: 'HTTP 404', sourceUrl: null },
        ],
        finalUrl: application.postingUrl,
        httpStatus: 404,
        id: 'listing-check-1',
        expectedVersion: 1,
        listingAvailability: 'suspected_closed',
        nextCheckAt: '2026-07-13T12:00:00.000Z',
        operationId: 'listing-check-operation-1',
        requestHash: 'listing-check-signature-1',
        outcome: 'closed',
        provider: 'example.test',
        receivedAt: recordedAt,
        reasonCode: 'http_404',
        recommendedAction: 'recheck',
        recordedAt,
        requestedUrl: application.postingUrl,
        runId: 'listing-run-1',
      })
      const firstProjection = yield* applications.findByIdentifier(
        application.applicationId
      )
      const secondApplied = yield* checks.persist({
        applicationId: application.applicationId,
        archiveApplication: true,
        checkedAt: '2026-07-13T12:00:00.000Z',
        checkerVersion: '1',
        closedCandidateAt: recordedAt,
        confidence: 'high',
        consecutiveClosedChecks: 2,
        contentHash: null,
        activityId: 'listing-closed-activity-1',
        evidence: [
          { code: 'http_status', detail: 'HTTP 404', sourceUrl: null },
        ],
        finalUrl: application.postingUrl,
        httpStatus: 404,
        id: 'listing-check-2',
        listingAvailability: 'closed',
        nextCheckAt: '2026-07-14T12:00:00.000Z',
        operationId: 'listing-check-operation-2',
        requestHash: 'listing-check-signature-2',
        outcome: 'closed',
        provider: 'example.test',
        receivedAt: '2026-07-13T12:00:00.000Z',
        reasonCode: 'http_404',
        recommendedAction: 'archive',
        recordedAt: '2026-07-13T12:00:00.000Z',
        requestedUrl: application.postingUrl,
        runId: null,
      })
      yield* checks.completeRun(
        'listing-run-1',
        {
          checkedCount: 1,
          closedCount: 0,
          errorCount: 0,
          openCount: 0,
          reviewCount: 1,
          selectedCount: 1,
        },
        '2026-07-12T12:01:00.000Z'
      )
      return {
        checks: yield* checks.listByApplication(application.applicationId),
        claimed,
        firstApplied,
        firstProjection,
        run: yield* checks.findRun('listing-run-1'),
        secondApplied,
        secondProjection: yield* applications.findByIdentifier(
          application.applicationId
        ),
      }
    })
  )

  assert.equal(result.claimed.length, 1)
  assert.equal(result.firstApplied, true)
  assert.equal(result.firstProjection?.listingAvailability, 'suspected_closed')
  assert.equal(result.secondApplied, true)
  assert.equal(result.secondProjection?.listingAvailability, 'closed')
  assert.equal(result.secondProjection?.applicationStatus, 'archived')
  assert.equal(result.checks.length, 2)
  assert.equal(result.run?.state, 'completed')

  const activities = await harness.query<{ kind: string }>(
    `select kind from application_activities where id = $1`,
    ['listing-closed-activity-1']
  )
  assert.deepEqual(activities, [{ kind: 'listing_availability_changed' }])
})

test('atomically starts scheduled runs and releases their leases on failure', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const checks = yield* ListingChecksCrud
      yield* seedApplication
      yield* checks.ensureEligibleSchedules(recordedAt)

      const started = yield* checks.startScheduledRun({
        id: 'scheduled-run-atomic',
        leaseUntil: '2026-07-12T12:20:00.000Z',
        limit: 5,
        mode: 'archive_eligible',
        now: recordedAt,
      })
      const empty = yield* checks.startScheduledRun({
        id: 'scheduled-run-empty',
        leaseUntil: '2026-07-12T12:20:00.000Z',
        limit: 5,
        mode: 'archive_eligible',
        now: recordedAt,
      })
      yield* checks.failRun({
        failedAt: '2026-07-12T12:01:00.000Z',
        failureCode: 'runner_failed',
        failureMessage: 'Synthetic runner interruption.',
        runId: 'scheduled-run-atomic',
      })

      return {
        empty,
        missingEmptyRun: yield* checks.findRun('scheduled-run-empty'),
        run: yield* checks.findRun('scheduled-run-atomic'),
        started,
      }
    })
  )

  assert.equal(result.started?.schedules.length, 1)
  assert.equal(result.started?.run.selectedCount, 1)
  assert.equal(result.empty, null)
  assert.equal(result.missingEmptyRun, undefined)
  assert.equal(result.run?.state, 'failed')
  assert.equal(result.run?.failureCode, 'runner_failed')

  const schedules = await harness.query<{
    leaseToken: string | null
    leaseUntil: Date | null
  }>(
    `select lease_token as "leaseToken", lease_until as "leaseUntil"
       from application_listing_check_schedules
      where application_id = $1`,
    [application.applicationId]
  )
  assert.deepEqual(schedules, [{ leaseToken: null, leaseUntil: null }])
})

test('reconciles orphaned scheduled runs before the next claim', async () => {
  const reconciled = await runCrud(
    Effect.gen(function* () {
      const checks = yield* ListingChecksCrud
      yield* seedApplication
      yield* checks.ensureEligibleSchedules(recordedAt)
      yield* checks.startScheduledRun({
        id: 'scheduled-run-orphaned',
        leaseUntil: '2026-07-12T12:20:00.000Z',
        limit: 5,
        mode: 'archive_eligible',
        now: recordedAt,
      })
      const count = yield* checks.reconcileOrphanedRuns({
        failedAt: '2026-07-12T12:21:00.000Z',
        staleBefore: '2026-07-12T12:01:00.000Z',
      })
      return {
        count,
        run: yield* checks.findRun('scheduled-run-orphaned'),
      }
    })
  )

  assert.equal(reconciled.count, 1)
  assert.equal(reconciled.run?.state, 'failed')
  assert.equal(reconciled.run?.failureCode, 'orphaned_run')
})

test('fences a superseded listing-check claimant from persisting or releasing the newer lease', async () => {
  const claimed = await runCrud(
    Effect.gen(function* () {
      const checks = yield* ListingChecksCrud
      yield* seedApplication
      yield* checks.ensureEligibleSchedules(recordedAt)
      return yield* checks.claimDue({
        leaseToken: 'superseded-listing-lease',
        leaseUntil: '2099-07-12T12:20:00.000Z',
        limit: 1,
        now: recordedAt,
      })
    })
  )
  assert.equal(claimed.length, 1)

  await harness.query(
    `update application_listing_check_schedules
        set lease_token = $1, lease_until = $2
      where application_id = $3 and lease_token = $4`,
    [
      'newer-listing-lease',
      '2099-07-12T12:40:00.000Z',
      application.applicationId,
      'superseded-listing-lease',
    ]
  )

  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const checks = yield* ListingChecksCrud
      const applied = yield* checks.persist(
        listingCheck({
          checkedAt: '2026-07-12T12:05:00.000Z',
          claimedLeaseToken: 'superseded-listing-lease',
          id: 'superseded-listing-check',
          nextCheckAt: '2026-07-13T12:05:00.000Z',
          operationId: 'superseded-listing-operation',
          receivedAt: '2026-07-12T12:05:00.000Z',
          recordedAt: '2026-07-12T12:05:00.000Z',
          requestHash: 'superseded-listing-signature',
        })
      )
      yield* checks.failClaim({
        applicationId: application.applicationId,
        error: 'The old claimant lost its lease.',
        leaseToken: 'superseded-listing-lease',
        nextAttemptAt: '2026-07-12T12:35:00.000Z',
        now: '2026-07-12T12:05:00.000Z',
      })
      return {
        application: yield* applications.findByIdentifier(
          application.applicationId
        ),
        applied,
        checks: yield* checks.listByApplication(application.applicationId),
      }
    })
  )

  assert.equal(result.applied, false)
  assert.deepEqual(result.checks, [])
  assert.equal(result.application?.listingAvailability, 'unchecked')
  assert.equal(result.application?.version, 1)

  const schedules = await harness.query<{
    attemptCount: number
    leaseToken: string | null
    leaseUntil: Date | null
  }>(
    `select attempt_count as "attemptCount",
            lease_token as "leaseToken",
            lease_until as "leaseUntil"
       from application_listing_check_schedules
      where application_id = $1`,
    [application.applicationId]
  )
  assert.deepEqual(schedules, [
    {
      attemptCount: 0,
      leaseToken: 'newer-listing-lease',
      leaseUntil: new Date('2099-07-12T12:40:00.000Z'),
    },
  ])

  const receipts = await harness.query<{ count: number }>(
    `select count(*)::int as count
       from idempotency_receipts
      where idempotency_key = $1`,
    ['superseded-listing-operation']
  )
  assert.deepEqual(receipts, [{ count: 0 }])
})

test('fences a lease that expired after the listing observation was recorded', async () => {
  const databaseClock = await harness.query<{ now: Date }>(
    'select current_timestamp as now'
  )
  const now = databaseClock.at(0)?.now
  assert.ok(now)
  const expiredAt = new Date(now.getTime() - 60_000).toISOString()
  const observedAt = new Date(now.getTime() - 120_000).toISOString()
  const nextCheckAt = new Date(now.getTime() + 86_400_000).toISOString()

  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const checks = yield* ListingChecksCrud
      yield* seedApplication
      yield* checks.ensureEligibleSchedules(recordedAt)
      const claimed = yield* checks.claimDue({
        leaseToken: 'expired-listing-lease',
        leaseUntil: expiredAt,
        limit: 1,
        now: recordedAt,
      })
      const applied = yield* checks.persist(
        listingCheck({
          checkedAt: observedAt,
          claimedLeaseToken: 'expired-listing-lease',
          id: 'expired-listing-check',
          nextCheckAt,
          operationId: 'expired-listing-operation',
          receivedAt: observedAt,
          recordedAt: observedAt,
          requestHash: 'expired-listing-signature',
        })
      )
      return {
        application: yield* applications.findByIdentifier(
          application.applicationId
        ),
        applied,
        claimed,
        checks: yield* checks.listByApplication(application.applicationId),
      }
    })
  )

  assert.equal(result.claimed.length, 1)
  assert.equal(result.applied, false)
  assert.deepEqual(result.checks, [])
  assert.equal(result.application?.listingAvailability, 'unchecked')
  assert.equal(result.application?.version, 1)

  const schedules = await harness.query<{ leaseToken: string | null }>(
    `select lease_token as "leaseToken"
       from application_listing_check_schedules
      where application_id = $1`,
    [application.applicationId]
  )
  assert.deepEqual(schedules, [{ leaseToken: 'expired-listing-lease' }])
})

test('enforces PostgreSQL foreign keys and cascades application children', async () => {
  await runCrud(
    Effect.gen(function* () {
      const annotations = yield* AnnotationsCrud
      yield* seedApplication
      yield* annotations.persistNote(
        application.applicationId,
        note('crud-note-1')
      )
    })
  )

  await assert.rejects(
    () =>
      harness.query(
        `insert into application_labels (application_id, label, created_at)
         values ($1, $2, $3)`,
        ['missing-application', 'invalid', recordedAt]
      ),
    (error: unknown) => {
      assert.equal(isSqlError(error), true)
      if (!isSqlError(error)) return false
      assert.equal(error.reason._tag, 'ConstraintError')
      return true
    }
  )

  const removed = await harness.query<{ id: string }>(
    `delete from applications where id = $1 returning id`,
    [application.applicationId]
  )
  assert.deepEqual(removed, [{ id: application.applicationId }])

  const notes = await harness.query<{ count: number }>(
    `select count(*)::int as count
       from application_notes
      where application_id = $1`,
    [application.applicationId]
  )
  const activities = await harness.query<{ count: number }>(
    `select count(*)::int as count
       from application_activities
      where application_id = $1`,
    [application.applicationId]
  )

  assert.deepEqual(notes, [{ count: 0 }])
  assert.deepEqual(activities, [{ count: 0 }])
})
