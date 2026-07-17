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
  assert.ok(openApi.paths['/v1/applications/{id}/annual-compensation'])
  assert.ok(openApi.paths['/v1/applications/{id}/compensations'])
  assert.ok(openApi.paths['/v1/applications/{id}/management'])
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
        filters: [
          {
            type: 'condition',
            field: 'applicationStatus',
            operator: 'in',
            value: ['not_started'],
          },
          {
            type: 'condition',
            field: 'company',
            operator: 'contains',
            value: 'Example',
          },
          {
            type: 'condition',
            field: 'followUpAt',
            operator: 'isNull',
          },
          {
            type: 'condition',
            field: 'labels',
            operator: 'hasAny',
            value: ['e2e'],
          },
          {
            type: 'condition',
            field: 'location',
            operator: 'contains',
            value: 'Tokyo',
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
            value: 'Integration',
          },
          {
            type: 'condition',
            field: 'targetStage',
            operator: 'in',
            value: ['apply_next'],
          },
        ],
        pagination: { size: 10 },
      },
    })
  )
  const searched = await Effect.runPromise(
    registry.registry.listApplications({
      query: { q: 'Integration Engineer' },
    })
  )
  assert.deepEqual(
    searched.items.map(({ id }) => id),
    [applicationId]
  )
  assert.deepEqual(
    listed.items.map((application) => application.id),
    [applicationId]
  )
  assert.equal(listed.pageInfo.nextCursor, null)
  assert.deepEqual(listed.items[0]?.labels, ['e2e', 'remote'])
  assert.deepEqual(listed.items[0]?.annualCompensation, {
    currencyCode: 'JPY',
    maximumMinor: 15_000_000,
    minimumMinor: 10_000_000,
  })
  assert.deepEqual(listed.items[0]?.counts, { captures: 0, notes: 0 })

  const patched = await Effect.runPromise(
    registry.registry.patchApplication({
      params: { id: applicationId },
      payload: {
        applicationStatus: 'preparing',
        expectedVersion: created.version,
        fitScore: 90,
        followUpAt: '2026-07-11T12:00:00.000Z',
      },
    })
  )
  assert.equal(patched.applicationStatus, 'preparing')
  assert.equal(patched.fitScore, 90)
  assert.equal(patched.version, created.version + 1)

  const managedPayload = {
    annualCompensation: {
      currencyCode: 'JPY',
      maximumMinor: 15_000_000,
      minimumMinor: 10_000_000,
    },
    applicationStatus: 'technical_screen',
    expectedVersion: patched.version,
    labels: ['e2e', 'remote', 'e2e'],
    operationId: 'e2e:managed-update:1',
  } as const
  const managed = await Effect.runPromise(
    registry.registry.updateManagedApplication({
      params: { id: applicationId },
      payload: managedPayload,
    })
  )
  const replayedManaged = await Effect.runPromise(
    registry.registry.updateManagedApplication({
      params: { id: applicationId },
      payload: managedPayload,
    })
  )
  assert.equal(managed.application.applicationStatus, 'technical_screen')
  assert.equal(managed.application.version, patched.version + 1)
  assert.deepEqual(managed.labels, ['e2e', 'remote'])
  assert.deepEqual(managed.annualCompensation, {
    currencyCode: 'JPY',
    maximumMinor: 15_000_000,
    minimumMinor: 10_000_000,
  })
  assert.equal(replayedManaged.application.id, applicationId)
  assert.equal(replayedManaged.application.version, managed.application.version)

  const staleManaged = await Effect.runPromise(
    Effect.flip(
      registry.registry.updateManagedApplication({
        params: { id: applicationId },
        payload: {
          expectedVersion: patched.version,
          labels: ['stale'],
          operationId: 'e2e:managed-update:stale',
        },
      })
    )
  )
  assert.equal(staleManaged._tag, 'ConflictError')

  const exactFit = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        filters: [
          {
            type: 'condition',
            field: 'fitScore',
            operator: 'gte',
            value: 90,
          },
          {
            type: 'condition',
            field: 'fitScore',
            operator: 'lte',
            value: 90,
          },
        ],
      },
    })
  )
  assert.deepEqual(
    exactFit.items.map((item) => item.id),
    [applicationId]
  )

  const aboveFit = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        filters: [
          {
            type: 'condition',
            field: 'fitScore',
            operator: 'gte',
            value: 91,
          },
        ],
      },
    })
  )
  assert.deepEqual(aboveFit.items, [])

  const scheduledFollowUp = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        filters: [
          {
            type: 'condition',
            field: 'followUpAt',
            operator: 'gte',
            value: '2026-07-11T00:00:00.000Z',
          },
          {
            type: 'condition',
            field: 'followUpAt',
            operator: 'lt',
            value: '2026-07-12T00:00:00.000Z',
          },
        ],
      },
    })
  )
  assert.deepEqual(
    scheduledFollowUp.items.map((item) => item.id),
    [applicationId]
  )

  const invalidFilterResponse = await fetch(
    new URL(
      `/v1/applications?${new URLSearchParams({
        filters: JSON.stringify([
          {
            type: 'condition',
            field: 'fitScore',
            operator: 'dropTable',
            value: 90,
          },
        ]),
      })}`,
      harness.url
    ),
    { headers: { authorization: `Bearer ${registryTestToken}` } }
  )
  assert.equal(invalidFilterResponse.status, 400)

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
  assert.equal(captured.application.fitScore, 88)
  assert.deepEqual(captured.capture.fitAssessment, captureInput.fitAssessment)

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

  const dashboardList = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        filters: [
          {
            type: 'condition',
            field: 'company',
            operator: 'contains',
            value: 'Example Company',
          },
        ],
        pagination: { size: 100 },
      },
    })
  )
  assert.equal(dashboardList.items.length, 1)
  assert.deepEqual(dashboardList.items[0]?.labels, ['e2e', 'remote'])
  assert.deepEqual(dashboardList.items[0]?.counts, { captures: 1, notes: 1 })
  assert.deepEqual(dashboardList.items[0]?.latestEvent, {
    kind: 'stage_changed',
    occurredAt: eventPayload.occurredAt,
  })

  const filteredEvents = await Effect.runPromise(
    registry.registry.listEvents({
      query: {
        filters: [
          {
            type: 'condition',
            field: 'occurredAt',
            operator: 'gte',
            value: eventPayload.occurredAt,
          },
          {
            type: 'condition',
            field: 'kind',
            operator: 'in',
            value: ['stage_changed'],
          },
          {
            type: 'condition',
            field: 'occurredAt',
            operator: 'lte',
            value: eventPayload.occurredAt,
          },
        ],
        pagination: { size: 100 },
      },
    })
  )
  assert.deepEqual(
    filteredEvents.items.map((item) => item.id),
    [event.event.id]
  )
  assert.equal(filteredEvents.items[0]?.company, applicationInput.company)
  assert.equal(filteredEvents.items[0]?.role, applicationInput.role)
  assert.equal(
    filteredEvents.items[0]?.canonicalUrl,
    applicationInput.canonicalUrl
  )

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

  const facets = await Effect.runPromise(
    registry.registry.listApplicationFacets()
  )
  assert.deepEqual(facets, {
    companies: ['Example Company', 'Secondary Company'],
    labels: ['e2e', 'remote'],
  })

  const multiStatus = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        filters: [
          {
            type: 'condition',
            field: 'applicationStatus',
            operator: 'in',
            value: ['applied', 'not_started'],
          },
        ],
        orderBy: [{ field: 'company', direction: 'desc' }],
        pagination: { size: 100 },
      },
    })
  )
  assert.deepEqual(
    multiStatus.items.map(({ id }) => id),
    [secondary.id, applicationId]
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

  const convertedDashboard = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        currency: 'USD',
        pagination: { size: 100 },
      },
    })
  )
  const convertedApplication = convertedDashboard.items.find(
    ({ id }) => id === applicationId
  )
  assert.deepEqual(convertedApplication?.annualCompensation, {
    currencyCode: 'USD',
    maximumMinor: 10_050_000,
    minimumMinor: 6_700_000,
  })

  const compensationApplication = await Effect.runPromise(
    registry.registry.getApplication({ params: { id: applicationId } })
  )
  const replacedCompensation = await Effect.runPromise(
    registry.registry.replaceAnnualCompensation({
      params: { id: applicationId },
      payload: {
        annualCompensation: {
          currencyCode: 'USD',
          maximumMinor: 16_000_000,
          minimumMinor: 12_000_000,
        },
        expectedVersion: compensationApplication.version,
      },
    })
  )
  assert.deepEqual(replacedCompensation.annualCompensation, {
    currencyCode: 'USD',
    maximumMinor: 16_000_000,
    minimumMinor: 12_000_000,
  })
  assert.equal(
    replacedCompensation.application.version,
    compensationApplication.version + 1
  )
  const staleCompensation = await Effect.runPromise(
    Effect.flip(
      registry.registry.replaceAnnualCompensation({
        params: { id: applicationId },
        payload: {
          annualCompensation: null,
          expectedVersion: compensationApplication.version,
        },
      })
    )
  )
  assert.equal(staleCompensation._tag, 'ConflictError')

  const replacedCompensationDashboard = await Effect.runPromise(
    registry.registry.listApplications({ query: { pagination: { size: 100 } } })
  )
  assert.deepEqual(
    replacedCompensationDashboard.items.find(({ id }) => id === applicationId)
      ?.annualCompensation,
    {
      currencyCode: 'USD',
      maximumMinor: 16_000_000,
      minimumMinor: 12_000_000,
    }
  )

  const firstPage = await Effect.runPromise(
    registry.registry.listApplications({ query: { pagination: { size: 1 } } })
  )
  assert.equal(firstPage.items.length, 1)
  assert.ok(firstPage.pageInfo.nextCursor)
  const secondPage = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        pagination: {
          after: firstPage.pageInfo.nextCursor ?? undefined,
          size: 1,
        },
      },
    })
  )
  assert.equal(secondPage.items.length, 1)
  assert.notEqual(secondPage.items[0]?.id, firstPage.items[0]?.id)
  assert.equal(secondPage.pageInfo.nextCursor, null)

  const eventBaseline = await Effect.runPromise(
    registry.registry.listEvents({
      query: {
        orderBy: [{ field: 'revision', direction: 'asc' }],
        pagination: { size: 100 },
      },
    })
  )
  assert.equal(eventBaseline.pageInfo.nextCursor, null)
  const eventBaselineRevision = eventBaseline.items.at(-1)?.revision
  assert.ok(eventBaselineRevision !== undefined)
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
          note: 'Arrived after the revision baseline with an old source time.',
        },
      },
    })
  )
  const eventsAfterBaseline = await Effect.runPromise(
    registry.registry.listEvents({
      query: {
        filters: [
          {
            type: 'condition',
            field: 'revision',
            operator: 'gt',
            value: eventBaselineRevision,
          },
        ],
        orderBy: [{ field: 'revision', direction: 'asc' }],
        pagination: { size: 100 },
      },
    })
  )
  assert.deepEqual(
    eventsAfterBaseline.items.map((item) => item.id),
    [delayedEvent.event.id]
  )

  const applicationBaseline = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        orderBy: [{ field: 'updatedRevision', direction: 'asc' }],
        pagination: { size: 100 },
      },
    })
  )
  assert.equal(applicationBaseline.pageInfo.nextCursor, null)
  const applicationBaselineRevision =
    applicationBaseline.items.at(-1)?.updatedRevision
  assert.ok(applicationBaselineRevision !== undefined)
  const current = await Effect.runPromise(
    registry.registry.getApplication({ params: { id: applicationId } })
  )
  await Effect.runPromise(
    registry.registry.patchApplication({
      params: { id: applicationId },
      payload: {
        expectedVersion: current.version,
        recommendedAction: 'Visible after the application revision baseline.',
      },
    })
  )
  const applicationsAfterBaseline = await Effect.runPromise(
    registry.registry.listApplications({
      query: {
        filters: [
          {
            type: 'condition',
            field: 'updatedRevision',
            operator: 'gt',
            value: applicationBaselineRevision,
          },
        ],
        orderBy: [{ field: 'updatedRevision', direction: 'asc' }],
        pagination: { size: 100 },
      },
    })
  )
  assert.deepEqual(
    applicationsAfterBaseline.items.map((item) => item.id),
    [applicationId]
  )

  await Effect.runPromise(
    registry.registry.deleteApplication({
      params: { id: secondary.id },
      query: {},
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
    'Visible after the application revision baseline.'
  )
})

test('supports cursor-paginated application and event lists over real HTTP', async () => {
  const paginationHarness = await RegistryWorkerHarness.make()
  try {
    const timestamp = '2026-07-12T00:00:00.000Z'
    const statements = Array.from({ length: 101 }, (_, index) => {
      const sequence = index + 1
      return paginationHarness.database
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
          `pagination-${sequence}`,
          `pagination:${sequence}`,
          'pagination-test',
          `https://example.test/jobs/pagination-${sequence}`,
          'Pagination Test',
          'pagination test',
          `Engineer ${sequence}`,
          sequence,
          timestamp,
          timestamp
        )
    })
    await paginationHarness.database.batch(statements.slice(0, 100))
    await paginationHarness.database.batch(statements.slice(100))

    const eventStatements = Array.from({ length: 101 }, (_, index) => {
      const sequence = index + 1
      return paginationHarness.database
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
          `pagination-${sequence}`,
          'research_updated',
          sequence,
          timestamp,
          timestamp,
          JSON.stringify({ sequence }),
          `pagination-operation-${sequence}`
        )
    })
    await paginationHarness.database.batch(eventStatements.slice(0, 100))
    await paginationHarness.database.batch(eventStatements.slice(100))

    const paginationRegistry = await Effect.runPromise(
      makeApplicationRegistryHttpClient({
        baseUrl: paginationHarness.url,
        token: Redacted.make(registryTestToken),
      }).pipe(Effect.provide(FetchHttpClient.layer))
    )

    const pageSizes: number[] = []
    const ids: string[] = []
    let after: string | undefined

    do {
      const page = await Effect.runPromise(
        paginationRegistry.registry.listApplications({
          query: { pagination: { after, size: 100 } },
        })
      )
      pageSizes.push(page.items.length)
      ids.push(...page.items.map(({ id }) => id))
      after = page.pageInfo.nextCursor ?? undefined
    } while (after !== undefined)

    assert.deepEqual(pageSizes, [100, 1])
    assert.equal(ids.length, 101)
    assert.equal(new Set(ids).size, 101)

    const filteredSortedIds: string[] = []
    let filteredSortedAfter: string | undefined

    do {
      const page = await Effect.runPromise(
        paginationRegistry.registry.listApplications({
          query: {
            filters: [
              {
                type: 'condition',
                field: 'applicationStatus',
                operator: 'notIn',
                value: ['rejected', 'withdrawn'],
              },
              {
                type: 'condition',
                field: 'listingAvailability',
                operator: 'ne',
                value: 'closed',
              },
            ],
            orderBy: [
              { field: 'applicationStatus', direction: 'desc' },
              { field: 'fitScore', direction: 'desc' },
            ],
            pagination: { after: filteredSortedAfter, size: 50 },
          },
        })
      )
      filteredSortedIds.push(...page.items.map(({ id }) => id))
      filteredSortedAfter = page.pageInfo.nextCursor ?? undefined
    } while (filteredSortedAfter !== undefined)

    assert.equal(filteredSortedIds.length, 101)
    assert.equal(new Set(filteredSortedIds).size, 101)

    const tooManyParameters = await Effect.runPromise(
      Effect.flip(
        paginationRegistry.registry.listApplications({
          query: {
            filters: [
              {
                type: 'condition',
                field: 'id',
                operator: 'in',
                value: ids,
              },
            ],
            pagination: { size: 1 },
          },
        })
      )
    )
    assert.equal(tooManyParameters._tag, 'BadRequestError')
    assert.match(tooManyParameters.message, /bound parameters/u)

    const eventPageSizes: number[] = []
    const eventIds: string[] = []
    let eventAfter: string | undefined

    do {
      const eventPage = await Effect.runPromise(
        paginationRegistry.registry.listEvents({
          query: { pagination: { after: eventAfter, size: 100 } },
        })
      )
      eventPageSizes.push(eventPage.items.length)
      eventIds.push(...eventPage.items.map(({ id }) => id))
      eventAfter = eventPage.pageInfo.nextCursor ?? undefined
    } while (eventAfter !== undefined)

    assert.deepEqual(eventPageSizes, [100, 1])
    assert.equal(eventIds.length, 101)
    assert.equal(new Set(eventIds).size, 101)

    const rankedEventIds: string[] = []
    let rankedEventAfter: string | undefined

    do {
      const eventPage = await Effect.runPromise(
        paginationRegistry.registry.listEvents({
          query: {
            orderBy: [{ field: 'kind', direction: 'desc' }],
            pagination: { after: rankedEventAfter, size: 50 },
          },
        })
      )
      rankedEventIds.push(...eventPage.items.map(({ id }) => id))
      rankedEventAfter = eventPage.pageInfo.nextCursor ?? undefined
    } while (rankedEventAfter !== undefined)

    assert.equal(rankedEventIds.length, 101)
    assert.equal(new Set(rankedEventIds).size, 101)
  } finally {
    await paginationHarness.dispose()
  }
})
