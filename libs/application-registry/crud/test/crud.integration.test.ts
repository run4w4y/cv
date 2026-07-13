import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import type { FxRate } from '@cv/application-registry-entity'
import { Effect } from 'effect'

import {
  AnnotationsCrud,
  ApplicationsCrud,
  EventsCrud,
  FxRatesCrud,
  type PersistedApplication,
  type PersistedEvent,
  type PersistedNote,
} from '../src'
import { makeRegistryCrudLive } from '../src/live'
import { RegistryMiniflareHarness } from '../src/test-support'

let harness: RegistryMiniflareHarness

const recordedAt = '2026-07-12T12:00:00.000Z'

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
    AnnotationsCrud | ApplicationsCrud | EventsCrud | FxRatesCrud
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
        { category: null, expectedVersion: 1, fitScore: 42 },
        '2026-07-12T13:00:00.000Z'
      )
      const page = yield* applications.list({ limit: 10, now: recordedAt })
      return { created, page, updated }
    })
  )

  assert.ok(result.created)
  assert.equal(result.created.id, 'crud-application-1')
  assert.equal(result.created.applicationStatus, 'not_started')
  assert.equal(result.created.targetStage, 'backlog')
  assert.equal(result.created.version, 1)

  assert.ok(result.updated)
  assert.equal(result.updated.category, null)
  assert.equal(result.updated.fitScore, 42)
  assert.equal(result.updated.version, 2)
  assert.deepEqual(
    result.page.items.map(({ id }) => id),
    ['crud-application-1']
  )
  assert.equal(result.page.hasNextPage, false)
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
    fitScore: 85,
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
    fitScore: 45,
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

      const page = yield* applications.list({
        applicationStatus: ['applied'],
        company: 'alpha',
        followUpState: ['overdue'],
        label: ['remote'],
        limit: 10,
        location: 'remote',
        now: recordedAt,
        personalPriority: ['high'],
        role: 'platform',
        targetStage: ['apply_next'],
      })
      const upcoming = yield* applications.list({
        followUpState: ['upcoming'],
        limit: 10,
        now: recordedAt,
      })
      const highFit = yield* applications.list({
        fitScoreMin: 80,
        limit: 10,
        now: recordedAt,
      })
      const lowFit = yield* applications.list({
        fitScoreMax: 50,
        limit: 10,
        now: recordedAt,
      })
      const facets = yield* applications.facets()
      return { facets, highFit, lowFit, page, upcoming }
    })
  )

  assert.deepEqual(
    result.page.items.map(({ id }) => id),
    [pastFollowUp.applicationId]
  )
  assert.deepEqual(result.page.items[0]?.labels, ['priority', 'remote'])
  assert.equal(result.page.items[0]?.compensations.length, 1)
  assert.equal(result.page.items[0]?.noteCount, 1)
  assert.equal(result.page.items[0]?.captureCount, 0)
  assert.equal(result.page.items[0]?.latestEventKind, 'note_added')
  assert.deepEqual(
    result.upcoming.items.map(({ id }) => id),
    [futureFollowUp.applicationId]
  )
  assert.deepEqual(
    result.highFit.items.map(({ id }) => id),
    [pastFollowUp.applicationId]
  )
  assert.deepEqual(
    result.lowFit.items.map(({ id }) => id),
    [futureFollowUp.applicationId]
  )
  assert.deepEqual(result.facets, {
    applicationStatuses: ['applied', 'preparing'],
    companies: ['Alpha Corp', 'Beta Corp'],
    labels: ['priority', 'remote'],
    personalPriorities: ['high', 'low'],
    targetStages: ['apply_next', 'backlog'],
  })
})

test('paginates every application and event with numeric limits', async () => {
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
      const firstApplicationPage = yield* applications.list({
        limit: 100,
        now: recordedAt,
      })
      const secondApplicationPage = yield* applications.list({
        afterRevision: 100,
        limit: 100,
        now: recordedAt,
      })
      const firstEventPage = yield* events.list({ limit: 100 })
      const secondEventPage = yield* events.list({
        afterRevision: 100,
        limit: 100,
      })
      return {
        firstApplicationPage,
        firstEventPage,
        secondApplicationPage,
        secondEventPage,
      }
    })
  )

  assert.equal(result.firstApplicationPage.items.length, 100)
  assert.equal(result.firstApplicationPage.hasNextPage, true)
  assert.equal(
    result.firstApplicationPage.items[0]?.latestEventKind,
    'research_updated'
  )
  assert.equal(result.secondApplicationPage.items.length, 1)
  assert.equal(result.secondApplicationPage.hasNextPage, false)
  assert.equal(result.firstEventPage.items.length, 100)
  assert.equal(result.firstEventPage.hasNextPage, true)
  assert.equal(result.secondEventPage.items.length, 1)
  assert.equal(result.secondEventPage.hasNextPage, false)
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
