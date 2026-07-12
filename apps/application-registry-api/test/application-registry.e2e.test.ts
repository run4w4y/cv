import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  type ApplicationRegistryHttpClientService,
  makeApplicationRegistryHttpClient,
} from '@cv/application-registry-api-client'
import { Effect, Redacted } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { applicationInput, captureInput } from './fixtures'
import {
  RegistryWorkerHarness,
  registryTestToken,
} from './support/registry-worker'

let harness: RegistryWorkerHarness
let registry: ApplicationRegistryHttpClientService

const connect = async () => {
  registry = await Effect.runPromise(
    makeApplicationRegistryHttpClient({
      baseUrl: harness.url,
      token: Redacted.make(registryTestToken),
    }).pipe(Effect.provide(FetchHttpClient.layer))
  )
}

before(async () => {
  harness = await RegistryWorkerHarness.make()
  await connect()
})

after(async () => {
  await harness?.dispose()
})

test('serves health and generated OpenAPI without authentication', async () => {
  const health = await fetch(new URL('/health', harness.url))
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { ok: true })

  const openApiResponse = await fetch(new URL('/openapi.json', harness.url))
  assert.equal(openApiResponse.status, 200)
  const openApi = await openApiResponse.json()
  assert.equal(openApi.openapi, '3.1.0')
  assert.ok(openApi.paths['/v1/applications'])
  assert.ok(openApi.paths['/v1/applications/{id}/compensations'])
  assert.equal(openApi.paths['/v1/imports'], undefined)
})

test('protects registry routes with bearer authentication', async () => {
  const response = await fetch(new URL('/v1/applications', harness.url))
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('runs typed CRUD, replay, cursor, and restart workflows', async () => {
  const created = await Effect.runPromise(
    registry.registry.upsertApplication({ payload: applicationInput })
  )
  const applicationId = created.id
  assert.match(applicationId, /^[0-9a-f-]{36}$/u)
  assert.equal(created.applicationStatus, 'not_started')
  assert.equal(created.version, 1)
  assert.equal(created.details?.countryCode, 'JP')
  assert.equal(created.details?.workMode, 'remote')
  assert.equal(created.details?.remoteRegion, 'Worldwide')

  const listed = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        applicationStatus: 'not_started',
        company: 'Example',
        label: 'e2e',
        limit: 10,
        targetStage: 'apply_next',
      },
    })
  )
  assert.deepEqual(
    listed.items.map((application) => application.id),
    [applicationId]
  )
  assert.equal(listed.nextCursor, null)
  assert.ok(listed.checkpoint)

  const patched = await Effect.runPromise(
    registry.registry.patchApplication({
      params: { id: applicationId },
      payload: {
        applicationStatus: 'preparing',
        expectedVersion: created.version,
        fitScore: 90,
      },
    })
  )
  assert.equal(patched.applicationStatus, 'preparing')
  assert.equal(patched.fitScore, 90)
  assert.equal(patched.version, created.version + 1)

  const staleVersion = await Effect.runPromise(
    Effect.flip(
      registry.registry.patchApplication({
        params: { id: applicationId },
        payload: {
          applicationStatus: 'rejected',
          expectedVersion: created.version,
        },
      })
    )
  )
  assert.equal(staleVersion._tag, 'ConflictError')

  const labels = await Effect.runPromise(
    registry.registry.replaceApplicationLabels({
      params: { id: applicationId },
      payload: { labels: ['e2e', 'priority', 'priority'] },
    })
  )
  assert.deepEqual(
    labels.map((label) => label.label),
    ['e2e', 'priority']
  )

  const notePayload = {
    body: 'Review the take-home expectations.',
    kind: 'interview_prep',
    operationId: 'e2e:note:1',
    source: 'e2e',
  } as const
  const note = await Effect.runPromise(
    registry.registry.addApplicationNote({
      params: { id: applicationId },
      payload: notePayload,
    })
  )
  const replayedNote = await Effect.runPromise(
    registry.registry.addApplicationNote({
      params: { id: applicationId },
      payload: notePayload,
    })
  )
  assert.equal(note.replayed, false)
  assert.equal(replayedNote.replayed, true)
  assert.equal(replayedNote.note.id, note.note.id)

  const annotations = await Effect.runPromise(
    registry.registry.listApplicationAnnotations({
      params: { id: applicationId },
    })
  )
  assert.deepEqual(
    annotations.labels.map((label) => label.label),
    ['e2e', 'priority']
  )
  assert.deepEqual(
    annotations.notes.map((applicationNote) => applicationNote.body),
    [notePayload.body]
  )

  const captured = await Effect.runPromise(
    registry.registry.createCapture({ payload: captureInput })
  )
  const replayedCapture = await Effect.runPromise(
    registry.registry.createCapture({ payload: captureInput })
  )
  assert.equal(captured.replayed, false)
  assert.equal(replayedCapture.replayed, true)
  assert.equal(replayedCapture.capture.id, captured.capture.id)
  assert.equal(captured.application.id, applicationId)

  const eventPayload = {
    deviceId: 'miniflare',
    expectedVersion: null,
    kind: 'stage_changed',
    nextApplicationStatus: 'applied',
    occurredAt: '2026-07-10T12:05:00.000Z',
    operationId: 'e2e:event:1',
    payload: { applicationStatus: 'applied' },
  } as const
  const event = await Effect.runPromise(
    registry.registry.appendApplicationEvent({
      params: { id: applicationId },
      payload: eventPayload,
    })
  )
  const replayedEvent = await Effect.runPromise(
    registry.registry.appendApplicationEvent({
      params: { id: applicationId },
      payload: eventPayload,
    })
  )
  assert.equal(event.replayed, false)
  assert.equal(replayedEvent.replayed, true)
  assert.equal(replayedEvent.event.id, event.event.id)
  assert.equal(replayedEvent.application.applicationStatus, 'applied')

  const secondary = await Effect.runPromise(
    registry.registry.upsertApplication({
      payload: {
        ...applicationInput,
        canonicalUrl: 'https://example.com/jobs/e2e-registry-secondary',
        company: 'Secondary Company',
        jobKey: 'url:https://example.com/jobs/e2e-registry-secondary',
        role: 'Secondary Integration Engineer',
      },
    })
  )

  const fetchedAt = new Date().toISOString()
  await harness.database
    .prepare(
      `insert into fx_rates (
        base_currency,
        quote_currency,
        rate,
        provider,
        observed_at,
        fetched_at
      ) values (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(
      'JPY',
      'USD',
      0.0067,
      'frankfurter',
      '2026-07-10T00:00:00.000Z',
      fetchedAt
    )
    .run()

  const compensations = await Effect.runPromise(
    registry.registry.listApplicationCompensations({
      params: { id: applicationId },
      query: { currency: 'USD' },
    })
  )
  assert.equal(compensations.items.length, 1)
  assert.equal(compensations.items[0]?.original.currencyCode, 'JPY')
  assert.equal(compensations.items[0]?.original.minimumMinor, 10_000_000)
  assert.equal(compensations.items[0]?.original.maximumMinor, 15_000_000)
  assert.deepEqual(compensations.items[0]?.conversion, {
    currencyCode: 'USD',
    maximumMinor: 10_050_000,
    minimumMinor: 6_700_000,
    observedAt: '2026-07-10T00:00:00.000Z',
    provider: 'frankfurter',
    rate: 0.0067,
  })

  const firstPage = await Effect.runPromise(
    registry.registry.listApplications({ query: { limit: 1 } })
  )
  assert.equal(firstPage.items.length, 1)
  assert.ok(firstPage.nextCursor)
  assert.ok(firstPage.checkpoint)
  const secondPage = await Effect.runPromise(
    registry.registry.listApplications({
      query: { after: firstPage.nextCursor, limit: 1 },
    })
  )
  assert.equal(secondPage.items.length, 1)
  assert.notEqual(secondPage.items[0]?.id, firstPage.items[0]?.id)
  assert.equal(secondPage.nextCursor, null)
  assert.ok(secondPage.checkpoint)

  const eventCheckpoint = await Effect.runPromise(
    registry.registry.listEvents({ query: { limit: 100 } })
  )
  assert.equal(eventCheckpoint.nextCursor, null)
  assert.ok(eventCheckpoint.checkpoint)
  const delayedEvent = await Effect.runPromise(
    registry.registry.appendApplicationEvent({
      params: { id: applicationId },
      payload: {
        deviceId: 'miniflare',
        expectedVersion: null,
        kind: 'research_updated',
        occurredAt: '2020-01-01T00:00:00.000Z',
        operationId: 'e2e:event:delayed',
        payload: {
          note: 'Arrived after the checkpoint with an old source time.',
        },
      },
    })
  )
  const eventsAfterCheckpoint = await Effect.runPromise(
    registry.registry.listEvents({
      query: { after: eventCheckpoint.checkpoint, limit: 100 },
    })
  )
  assert.deepEqual(
    eventsAfterCheckpoint.items.map((item) => item.id),
    [delayedEvent.event.id]
  )

  const applicationCheckpoint = await Effect.runPromise(
    registry.registry.listApplications({ query: { limit: 100 } })
  )
  assert.equal(applicationCheckpoint.nextCursor, null)
  assert.ok(applicationCheckpoint.checkpoint)
  const current = await Effect.runPromise(
    registry.registry.getApplication({ params: { id: applicationId } })
  )
  await Effect.runPromise(
    registry.registry.patchApplication({
      params: { id: applicationId },
      payload: {
        expectedVersion: current.version,
        recommendedAction: 'Visible after the application checkpoint.',
      },
    })
  )
  const applicationsAfterCheckpoint = await Effect.runPromise(
    registry.registry.listApplications({
      query: { after: applicationCheckpoint.checkpoint, limit: 100 },
    })
  )
  assert.deepEqual(
    applicationsAfterCheckpoint.items.map((item) => item.id),
    [applicationId]
  )

  await Effect.runPromise(
    registry.registry.deleteApplication({
      params: { id: secondary.id },
    })
  )
  const removed = await Effect.runPromise(
    Effect.flip(
      registry.registry.getApplication({
        params: { id: secondary.id },
      })
    )
  )
  assert.equal(removed._tag, 'NotFoundError')

  await harness.restart()
  await connect()
  const persisted = await Effect.runPromise(
    registry.registry.getApplication({ params: { id: applicationId } })
  )
  assert.equal(persisted.company, applicationInput.company)
  assert.equal(persisted.applicationStatus, 'applied')
  assert.equal(
    persisted.recommendedAction,
    'Visible after the application checkpoint.'
  )
})
