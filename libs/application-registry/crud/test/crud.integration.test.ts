import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import type { FxRate } from '@cv/application-registry-entity'
import {
  applicationListQuery,
  eventListQuery,
} from '@cv/application-registry-entity/query'
import { Effect } from 'effect'

import {
  AnnotationsCrud,
  ApplicationsCrud,
  CompensationsCrud,
  EventsCrud,
  FxRatesCrud,
  ListingChecksCrud,
  type PersistedApplication,
  type PersistedEvent,
  type PersistedNote,
} from '../src'
import { makeRegistryCrudLive } from '../src/live'
import { RegistryMiniflareHarness } from '../src/test-support'

let harness: RegistryMiniflareHarness

const recordedAt = '2026-07-12T12:00:00.000Z'

const resolveApplicationList = (
  request: Parameters<typeof applicationListQuery.resolve>[0]
) => applicationListQuery.resolve(request)

const resolveEventList = (
  request: Parameters<typeof eventListQuery.resolve>[0]
) => eventListQuery.resolve(request)

const application: PersistedApplication = {
  applicationId: 'crud-application-1',
  canonicalUrl: 'https://example.test/jobs/crud-1',
  company: 'CRUD Test',
  jobKey: 'test:crud-1',
  location: null,
  recordedAt,
  role: 'Database Engineer',
  source: 'test',
  sourceJobId: null,
}

const note = (noteId: string): PersistedNote => ({
  body: `Note ${noteId}`,
  eventId: `event-${noteId}`,
  kind: 'general',
  noteId,
  operationId: 'crud-note-operation',
  operationRequestSignature: 'crud-note-signature',
  recordedAt,
  source: 'crud-test',
})

const event = (sequence: number): PersistedEvent => ({
  deviceId: null,
  eventId: `crud-event-${sequence}`,
  kind: 'research_updated',
  occurredAt: recordedAt,
  operationId: `crud-event-operation-${sequence}`,
  operationRequestSignature: `crud-event-signature-${sequence}`,
  payload: { sequence },
  recordedAt,
})

const fxRate: FxRate = {
  baseCurrency: 'USD',
  fetchedAt: recordedAt,
  observedAt: '2026-07-12T00:00:00.000Z',
  provider: 'crud-test',
  quoteCurrency: 'EUR',
  rate: 0.91,
}

const runCrud = <A, E>(
  program: Effect.Effect<
    A,
    E,
    | AnnotationsCrud
    | ApplicationsCrud
    | CompensationsCrud
    | EventsCrud
    | FxRatesCrud
    | ListingChecksCrud
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
    operation: 'CRUD integration application seed',
  })
  return yield* applications.findByIdentifier(application.applicationId)
})

beforeEach(async () => {
  harness = await RegistryMiniflareHarness.make({
    databaseBinding: 'APPLICATION_REGISTRY_DB',
  })
})

afterEach(async () => {
  await harness.dispose()
})

test('executes application CRUD and database defaults through slice services', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const created = yield* seedApplication
      const updated = yield* applications.patch(
        application.applicationId,
        { expectedVersion: 1, location: 'Remote' },
        '2026-07-12T13:00:00.000Z'
      )
      const page = yield* applications.list(
        resolveApplicationList({ pagination: { size: 10 } })
      )
      return { created, page, updated }
    })
  )

  assert.ok(result.created)
  assert.equal(result.created.id, 'crud-application-1')
  assert.equal(result.created.applicationStatus, 'not_started')
  assert.equal(result.created.targetStage, 'backlog')
  assert.equal(result.created.version, 1)

  assert.ok(result.updated)
  assert.equal(result.updated.location, 'Remote')
  assert.equal(result.updated.version, 2)
  assert.deepEqual(
    result.page.items.map(({ id }) => id),
    ['crud-application-1']
  )
  assert.equal(result.page.pageInfo.hasNextPage, false)
})

test('atomically replaces annual compensation and rejects a stale version', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const compensations = yield* CompensationsCrud
      yield* applications.persist(
        {
          ...application,
          compensations: [
            {
              id: 'crud-annual-original',
              kind: 'base_salary',
              currencyCode: 'USD',
              minimumMinor: 12_000_000,
              maximumMinor: 15_000_000,
              period: 'year',
              rawText: null,
              source: 'crud-test',
            },
          ],
        },
        {
          mode: 'replace',
          operation: 'annual compensation seed',
        }
      )
      const replaced = yield* compensations.replaceAnnual(
        application.applicationId,
        1,
        {
          id: 'crud-annual-replacement',
          kind: 'base_salary',
          currencyCode: 'EUR',
          minimumMinor: 10_000_000,
          maximumMinor: 13_000_000,
          rawText: null,
          source: 'table',
        },
        '2026-07-12T13:00:00.000Z'
      )
      const stale = yield* compensations.replaceAnnual(
        application.applicationId,
        1,
        null,
        '2026-07-12T14:00:00.000Z'
      )
      return {
        application: yield* applications.findByIdentifier(
          application.applicationId
        ),
        compensations: yield* compensations.listByApplication(
          application.applicationId
        ),
        replaced,
        stale,
      }
    })
  )

  assert.equal(result.replaced, true)
  assert.equal(result.stale, false)
  assert.equal(result.application?.version, 2)
  assert.deepEqual(
    result.compensations.map(({ currencyCode, id }) => ({ currencyCode, id })),
    [{ currencyCode: 'EUR', id: 'crud-annual-replacement' }]
  )
})

test('clears every annual compensation variant without removing bonuses', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const compensations = yield* CompensationsCrud
      yield* applications.persist(
        {
          ...application,
          compensations: [
            {
              id: 'crud-clear-base',
              kind: 'base_salary',
              currencyCode: 'USD',
              minimumMinor: 12_000_000,
              maximumMinor: 15_000_000,
              period: 'year',
              rawText: null,
              source: 'crud-test',
            },
            {
              id: 'crud-clear-total',
              kind: 'total_compensation',
              currencyCode: 'USD',
              minimumMinor: 15_000_000,
              maximumMinor: 18_000_000,
              period: 'year',
              rawText: null,
              source: 'crud-test',
            },
            {
              id: 'crud-preserve-bonus',
              kind: 'bonus',
              currencyCode: 'USD',
              minimumMinor: 1_000_000,
              maximumMinor: 2_000_000,
              period: 'year',
              rawText: null,
              source: 'crud-test',
            },
          ],
        },
        { mode: 'replace', operation: 'annual compensation clear seed' }
      )
      const cleared = yield* compensations.replaceAnnual(
        application.applicationId,
        1,
        null,
        '2026-07-12T13:00:00.000Z'
      )
      return {
        cleared,
        items: yield* compensations.listByApplication(
          application.applicationId
        ),
      }
    })
  )

  assert.equal(result.cleared, true)
  assert.deepEqual(
    result.items.map(({ id }) => id),
    ['crud-preserve-bonus']
  )
})

test('atomically replaces labels and preserves them after a stale write', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const annotations = yield* AnnotationsCrud
      const applications = yield* ApplicationsCrud
      yield* applications.persist(application, {
        mode: 'replace',
        operation: 'label replacement seed',
      })
      const replaced = yield* annotations.replaceLabels(
        application.applicationId,
        ['Remote', 'TypeScript', 'Remote'],
        '2026-07-12T13:00:00.000Z',
        1
      )
      const stale = yield* annotations.replaceLabels(
        application.applicationId,
        ['Stale'],
        '2026-07-12T14:00:00.000Z',
        1
      )
      return {
        application: yield* applications.findByIdentifier(
          application.applicationId
        ),
        labels: yield* annotations.listLabels(application.applicationId),
        replaced,
        stale,
      }
    })
  )

  assert.deepEqual(
    result.replaced?.map(({ label }) => label),
    ['Remote', 'TypeScript']
  )
  assert.equal(result.stale, undefined)
  assert.equal(result.application?.version, 2)
  assert.deepEqual(
    result.labels.map(({ label }) => label),
    ['Remote', 'TypeScript']
  )
})

test('updates a managed application aggregate in one version transition', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const annotations = yield* AnnotationsCrud
      const applications = yield* ApplicationsCrud
      const compensations = yield* CompensationsCrud
      const events = yield* EventsCrud
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
        { mode: 'replace', operation: 'managed update seed' }
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
          event: {
            deviceId: null,
            eventId: 'managed-status-event',
            kind: 'submitted',
            occurredAt: '2026-07-12T13:00:00.000Z',
            operationId: 'managed-operation',
            operationRequestSignature: 'managed-signature',
            payload: {
              source: 'application_registry_management',
              previousApplicationStatus: 'not_started',
              nextApplicationStatus: 'applied',
            },
            recordedAt: '2026-07-12T13:00:00.000Z',
          },
          expectedVersion: 1,
          labels: ['remote', 'priority', 'remote'],
          operationId: 'managed-operation',
          operationRequestSignature: 'managed-signature',
          patch: {
            applicationStatus: 'applied',
            company: 'Managed Company',
            personalPriority: 'high',
          },
          recordedAt: '2026-07-12T13:00:00.000Z',
        }
      )
      const stale = yield* applications.updateManaged(
        application.applicationId,
        {
          annualCompensation: {
            replacement: null,
          },
          event: undefined,
          expectedVersion: 1,
          labels: ['stale'],
          operationId: 'managed-operation-stale',
          operationRequestSignature: 'managed-signature-stale',
          patch: { personalPriority: 'low' },
          recordedAt: '2026-07-12T14:00:00.000Z',
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
        events: yield* events.listByApplication(application.applicationId),
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
    result.events.map(({ kind, operationId, revision }) => ({
      kind,
      operationId,
      revision,
    })),
    [{ kind: 'submitted', operationId: 'managed-operation', revision: 2 }]
  )
})

test('filters before pagination and returns dashboard details and facets', async () => {
  const pastFollowUp: PersistedApplication = {
    ...application,
    applicationId: 'crud-dashboard-past',
    applicationStatus: 'applied',
    canonicalUrl: 'https://example.test/jobs/dashboard-past',
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
    jobKey: 'test:dashboard-past',
    labels: ['remote', 'priority'],
    location: 'Remote',
    personalPriority: 'high',
    role: 'Platform Engineer',
    targetStage: 'apply_next',
  }
  const futureFollowUp: PersistedApplication = {
    ...application,
    applicationId: 'crud-dashboard-future',
    applicationStatus: 'preparing',
    canonicalUrl: 'https://example.test/jobs/dashboard-future',
    company: 'Beta Corp',
    followUpAt: '2026-07-12T13:00:00.000Z',
    jobKey: 'test:dashboard-future',
    labels: ['remote'],
    personalPriority: 'low',
    targetStage: 'backlog',
  }

  const result = await runCrud(
    Effect.gen(function* () {
      const annotations = yield* AnnotationsCrud
      const applications = yield* ApplicationsCrud
      yield* applications.persist(pastFollowUp, {
        mode: 'replace',
        operation: 'dashboard past seed',
      })
      yield* applications.persist(futureFollowUp, {
        mode: 'replace',
        operation: 'dashboard future seed',
      })
      yield* annotations.persistNote(
        pastFollowUp.applicationId,
        note('crud-dashboard-note')
      )

      yield* Effect.promise(() =>
        harness.database.batch([
          harness.database
            .prepare(
              `insert into application_identity_aliases (
                job_key,
                application_id,
                created_at
              ) values (?1, ?2, ?3)`
            )
            .bind(
              'test:dashboard-past:z-alias',
              pastFollowUp.applicationId,
              recordedAt
            ),
          harness.database
            .prepare(
              `insert into application_identity_aliases (
                job_key,
                application_id,
                created_at
              ) values (?1, ?2, ?3)`
            )
            .bind(
              'test:dashboard-past:a-alias',
              pastFollowUp.applicationId,
              recordedAt
            ),
          harness.database
            .prepare(
              `insert into campaign_captures (
                id,
                application_id,
                campaign_run_id,
                profile,
                application_url,
                submission_details,
                artifacts,
                captured_at,
                operation_id
              ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
            )
            .bind(
              'crud-dashboard-capture-old',
              pastFollowUp.applicationId,
              'crud-dashboard-run',
              'default',
              'https://example.test/jobs/dashboard-past/apply-old',
              JSON.stringify({}),
              JSON.stringify([]),
              '2026-07-12T10:00:00.000Z',
              'crud-dashboard-capture-operation-old'
            ),
          harness.database
            .prepare(
              `insert into campaign_captures (
                id,
                application_id,
                campaign_run_id,
                profile,
                application_url,
                submission_details,
                artifacts,
                captured_at,
                operation_id
              ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
            )
            .bind(
              'crud-dashboard-capture-new',
              pastFollowUp.applicationId,
              'crud-dashboard-run',
              'default',
              'https://example.test/jobs/dashboard-past/apply-new',
              JSON.stringify({}),
              JSON.stringify([]),
              '2026-07-12T11:00:00.000Z',
              'crud-dashboard-capture-operation-new'
            ),
        ])
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
  assert.deepEqual(result.page.items[0]?.identityAliases, [
    'test:dashboard-past:a-alias',
    'test:dashboard-past:z-alias',
  ])
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
  assert.deepEqual(result.page.items[0]?.counts, { captures: 2, notes: 1 })
  assert.deepEqual(result.page.items[0]?.latestEvent, {
    kind: 'note_added',
    occurredAt: recordedAt,
  })
  assert.equal(
    result.page.items[0]?.latestCapture?.applicationUrl,
    'https://example.test/jobs/dashboard-past/apply-new'
  )
  assert.deepEqual(
    result.upcoming.items.map(({ id }) => id),
    [futureFollowUp.applicationId]
  )
  assert.deepEqual(result.facets, {
    companies: ['Alpha Corp', 'Beta Corp'],
    labels: ['priority', 'remote'],
  })
})

test('paginates every application and event with numeric page sizes', async () => {
  const itemCount = 101
  const applicationStatements = Array.from(
    { length: itemCount },
    (_, index) => {
      const sequence = index + 1
      return harness.database
        .prepare(
          `insert into applications (
          id,
          job_key,
          source,
          canonical_url,
          company,
          company_normalized,
          role,
          updated_revision,
          created_at,
          updated_at
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
        )
        .bind(
          `pagination-application-${sequence}`,
          `pagination:${sequence}`,
          'pagination-test',
          `https://example.test/jobs/pagination-${sequence}`,
          'Pagination Test',
          'pagination test',
          `Engineer ${sequence}`,
          sequence,
          recordedAt,
          recordedAt
        )
    }
  )
  await harness.database.batch(applicationStatements.slice(0, 100))
  await harness.database.batch(applicationStatements.slice(100))

  const eventStatements = Array.from({ length: itemCount }, (_, index) => {
    const sequence = index + 1
    return harness.database
      .prepare(
        `insert into application_events (
          id,
          application_id,
          kind,
          revision,
          occurred_at,
          recorded_at,
          payload,
          operation_id
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        `pagination-event-${sequence}`,
        `pagination-application-${sequence}`,
        'research_updated',
        sequence,
        recordedAt,
        recordedAt,
        JSON.stringify({ sequence }),
        `pagination-operation-${sequence}`
      )
  })
  await harness.database.batch(eventStatements.slice(0, 100))
  await harness.database.batch(eventStatements.slice(100))

  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      const events = yield* EventsCrud
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
      const firstEventPage = yield* events.list(
        resolveEventList({ pagination: { size: 100 } })
      )
      const secondEventPage = yield* events.list(
        resolveEventList({
          pagination: {
            after: firstEventPage.pageInfo.nextCursor ?? undefined,
            size: 100,
          },
        })
      )
      return {
        firstApplicationPage,
        firstEventPage,
        secondApplicationPage,
        secondEventPage,
      }
    })
  )

  assert.equal(result.firstApplicationPage.items.length, 100)
  assert.equal(result.firstApplicationPage.pageInfo.hasNextPage, true)
  assert.equal(
    result.firstApplicationPage.items[0]?.latestEvent?.kind,
    'research_updated'
  )
  assert.equal(result.secondApplicationPage.items.length, 1)
  assert.equal(result.secondApplicationPage.pageInfo.hasNextPage, false)
  assert.equal(result.firstEventPage.items.length, 100)
  assert.equal(result.firstEventPage.pageInfo.hasNextPage, true)
  assert.equal(result.secondEventPage.items.length, 1)
  assert.equal(result.secondEventPage.pageInfo.hasNextPage, false)
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

test('persists events with an explicit optional application status transition', async () => {
  const result = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      yield* seedApplication
      yield* applications.persistEvent(
        application.applicationId,
        1,
        undefined,
        event(1)
      )
      const unchanged = yield* applications.findByIdentifier(
        application.applicationId
      )
      yield* applications.persistEvent(
        application.applicationId,
        2,
        'applied',
        event(2)
      )
      const transitioned = yield* applications.findByIdentifier(
        application.applicationId
      )
      return { transitioned, unchanged }
    })
  )

  assert.ok(result.unchanged)
  assert.equal(result.unchanged.applicationStatus, 'not_started')
  assert.equal(result.unchanged.version, 2)
  assert.ok(result.transitioned)
  assert.equal(result.transitioned.applicationStatus, 'applied')
  assert.equal(result.transitioned.version, 3)
})

test('persists and retrieves FX cache rows through FxRatesCrud', async () => {
  const stored = await runCrud(
    Effect.gen(function* () {
      const fxRates = yield* FxRatesCrud
      yield* fxRates.save(fxRate)
      return yield* fxRates.findLatest('USD', 'EUR')
    })
  )

  assert.ok(stored)
  assert.equal(stored.baseCurrency, 'USD')
  assert.equal(stored.quoteCurrency, 'EUR')
  assert.equal(stored.rate, 0.91)
})

test('claims, records, and archives listing checks through migrated D1 tables', async () => {
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
        leaseUntil: '2026-07-12T12:20:00.000Z',
        limit: 10,
        now: recordedAt,
      })
      const firstApplied = yield* checks.persist({
        applicationId: application.applicationId,
        archiveApplication: false,
        checkedAt: recordedAt,
        checkerVersion: '1',
        closedCandidateAt: recordedAt,
        confidence: 'high',
        consecutiveClosedChecks: 1,
        contentHash: null,
        eventId: null,
        evidence: [
          { code: 'http_status', detail: 'HTTP 404', sourceUrl: null },
        ],
        finalUrl: application.canonicalUrl,
        httpStatus: 404,
        id: 'listing-check-1',
        listingAvailability: 'suspected_closed',
        nextCheckAt: '2026-07-13T12:00:00.000Z',
        operationId: 'listing-check-operation-1',
        operationRequestSignature: 'listing-check-signature-1',
        outcome: 'closed',
        provider: 'example.test',
        receivedAt: recordedAt,
        reasonCode: 'http_404',
        recommendedAction: 'recheck',
        recordedAt,
        requestedUrl: application.canonicalUrl,
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
        eventId: 'listing-closed-event-1',
        evidence: [
          { code: 'http_status', detail: 'HTTP 404', sourceUrl: null },
        ],
        finalUrl: application.canonicalUrl,
        httpStatus: 404,
        id: 'listing-check-2',
        listingAvailability: 'closed',
        nextCheckAt: '2026-07-14T12:00:00.000Z',
        operationId: 'listing-check-operation-2',
        operationRequestSignature: 'listing-check-signature-2',
        outcome: 'closed',
        provider: 'example.test',
        receivedAt: '2026-07-13T12:00:00.000Z',
        reasonCode: 'http_404',
        recommendedAction: 'archive',
        recordedAt: '2026-07-13T12:00:00.000Z',
        requestedUrl: application.canonicalUrl,
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

  const events = await harness.query<{ kind: string }>(
    `select kind from application_events where id = ?1`,
    ['listing-closed-event-1']
  )
  assert.deepEqual(events, [{ kind: 'listing_closed' }])
})

test('enforces migrated D1 foreign keys and cascades application children', async () => {
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
         values (?1, ?2, ?3)`,
        ['missing-application', 'invalid', recordedAt]
      ),
    /FOREIGN KEY constraint failed/u
  )

  const removed = await runCrud(
    Effect.gen(function* () {
      const applications = yield* ApplicationsCrud
      return yield* applications.remove(application.applicationId)
    })
  )
  assert.equal(removed, true)

  const notes = await harness.query<{ count: number }>(
    `select count(*) as count
       from application_notes
      where application_id = ?1`,
    [application.applicationId]
  )
  const events = await harness.query<{ count: number }>(
    `select count(*) as count
       from application_events
      where application_id = ?1`,
    [application.applicationId]
  )

  assert.deepEqual(notes, [{ count: 0 }])
  assert.deepEqual(events, [{ count: 0 }])
})
