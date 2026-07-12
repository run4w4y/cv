import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Schema } from 'effect'

import { RegistryMiniflareHarness } from '../src/test-support'

let harness: RegistryMiniflareHarness

beforeEach(async () => {
  harness = await RegistryMiniflareHarness.make({
    databaseBinding: 'APPLICATION_REGISTRY_DB',
    workerBundlePath: fileURLToPath(
      new URL('./dist/worker.js', import.meta.url)
    ),
    workerName: 'crud-test',
  })
})

afterEach(async () => {
  await harness.dispose()
})

test('executes application CRUD and database defaults through slice services', async () => {
  const created = await harness.fetchJson(
    Schema.Struct({
      applicationStatus: Schema.String,
      id: Schema.String,
      targetStage: Schema.String,
      version: Schema.Number,
    }),
    '/applications/seed'
  )

  assert.equal(created.id, 'crud-application-1')
  assert.equal(created.applicationStatus, 'not_started')
  assert.equal(created.targetStage, 'backlog')
  assert.equal(created.version, 1)

  const updated = await harness.fetchJson(
    Schema.Struct({
      category: Schema.NullOr(Schema.String),
      fitScore: Schema.NullOr(Schema.Number),
      version: Schema.Number,
    }),
    '/applications/patch'
  )
  assert.equal(updated.category, null)
  assert.equal(updated.fitScore, 42)
  assert.equal(updated.version, 2)

  const page = await harness.fetchJson(
    Schema.Struct({
      hasNextPage: Schema.Boolean,
      items: Schema.Array(Schema.Struct({ id: Schema.String })),
    }),
    '/applications/list'
  )
  assert.deepEqual(
    page.items.map(({ id }) => id),
    ['crud-application-1']
  )
  assert.equal(page.hasNextPage, false)
})

test('rolls back an atomic note write when its operation receipt conflicts', async () => {
  await harness.fetchJson(Schema.Unknown, '/applications/seed')
  await harness.fetchJson(Schema.Unknown, '/notes/first')

  const conflict = await harness.fetch('/notes/conflict')
  assert.equal(conflict.status, 500)

  const notes = await harness.query(
    Schema.Struct({ id: Schema.String }),
    'select id from application_notes order by id'
  )
  assert.deepEqual(notes, [{ id: 'crud-note-1' }])
})

test('persists events with an explicit optional application status transition', async () => {
  await harness.fetchJson(Schema.Unknown, '/applications/seed')

  const unchanged = await harness.fetchJson(
    Schema.Struct({
      applicationStatus: Schema.String,
      version: Schema.Number,
    }),
    '/events/no-status'
  )
  assert.equal(unchanged.applicationStatus, 'not_started')
  assert.equal(unchanged.version, 2)

  const transitioned = await harness.fetchJson(
    Schema.Struct({
      applicationStatus: Schema.String,
      version: Schema.Number,
    }),
    '/events/with-status'
  )
  assert.equal(transitioned.applicationStatus, 'applied')
  assert.equal(transitioned.version, 3)
})

test('persists and retrieves FX cache rows through FxRatesCrud', async () => {
  const stored = await harness.fetchJson(
    Schema.Struct({
      baseCurrency: Schema.String,
      quoteCurrency: Schema.String,
      rate: Schema.Number,
    }),
    '/fx'
  )

  assert.equal(stored.baseCurrency, 'USD')
  assert.equal(stored.quoteCurrency, 'EUR')
  assert.equal(stored.rate, 0.91)
})

test('enforces migrated D1 foreign keys and cascades application children', async () => {
  await harness.fetchJson(Schema.Unknown, '/applications/seed')
  await harness.fetchJson(Schema.Unknown, '/notes/first')

  await assert.rejects(
    () =>
      harness.query(
        Schema.Unknown,
        `insert into application_labels (application_id, label, created_at)
         values (?1, ?2, ?3)`,
        ['missing-application', 'invalid', '2026-07-12T12:00:00.000Z']
      ),
    /FOREIGN KEY constraint failed/u
  )

  const removed = await harness.fetchJson(
    Schema.Boolean,
    '/applications/remove'
  )
  assert.equal(removed, true)

  const notes = await harness.query(
    Schema.Struct({ count: Schema.Number }),
    `select count(*) as count
       from application_notes
      where application_id = ?1`,
    ['crud-application-1']
  )
  const events = await harness.query(
    Schema.Struct({ count: Schema.Number }),
    `select count(*) as count
       from application_events
      where application_id = ?1`,
    ['crud-application-1']
  )

  assert.deepEqual(notes, [{ count: 0 }])
  assert.deepEqual(events, [{ count: 0 }])
})
