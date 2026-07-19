import { describe, expect, test } from 'bun:test'
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from '@cloudflare/workers-types'
import {
  ApplicationRegistryApi,
  RegistryAuthorization,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ApplicationEvent,
  ApplicationListingCheck,
  ApplicationNote,
  ListingCheckRun,
} from '@cv/application-registry-entity'
import {
  type AddApplicationNoteInput,
  AnnotationsService,
  ApplicationsService,
  CompensationsService,
  ContentEntriesService,
  CvAnalyticsService,
  CvPublicationsService,
  EventsService,
  FactsReleasesService,
  JobPostingCaptureService,
  JobPostingSnapshotsService,
  type ListApplicationsInput,
  ListingChecksService,
  OpaqueObjectsService,
  PdfArtifactsService,
  RegistryDatabaseError,
  type ResolveListingAvailabilityInput,
} from '@cv/application-registry-service'
import { Effect, Layer, type Scope } from 'effect'
import {
  HttpClientRequest,
  type HttpRouter,
  HttpServer,
} from 'effect/unstable/http'
import { HttpApiMiddleware, HttpApiTest } from 'effect/unstable/httpapi'

import { makeWorkerRequestContext, WorkerEnv } from '../worker/bindings'
import type {
  ApplicationRegistryEnv,
  WorkerExecutionContext,
} from '../worker/types'
import { HealthHandlersLayer } from './handlers/health'
import { RegistryHandlersLayer } from './handlers/registry'
import { RegistryAuthorizationLayer } from './middleware/auth'

const context: WorkerExecutionContext = { waitUntil: () => undefined }
const env = {
  // Persistence is replaced by makeRegistryLayer in these HTTP codec tests.
  APPLICATION_REGISTRY_DB: undefined as unknown as D1Database,
  CHATGPT_SESSIONS: undefined as unknown as KVNamespace,
  CLOUDFLARE_ANALYTICS_API_TOKEN: 'analytics-token',
  CLOUDFLARE_ZONE_ID: 'zone-id',
  CV_WEB_HOST: 'cv.example.test',
  CV_OBJECTS: undefined as unknown as R2Bucket,
  REGISTRY_API_TOKEN: 'test-token',
} satisfies ApplicationRegistryEnv

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  id: 'application-1',
  jobKey: 'web:one',
  source: 'web',
  sourceJobId: null,
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  followUpAt: null,
  role: 'Engineer',
  location: null,
  lastContactAt: null,
  listingAvailability: 'unchecked',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  personalPriority: null,
  targetStage: 'backlog',
  version: 1,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
  updatedRevision: 1,
}

const event: ApplicationEvent = {
  id: 'event-1',
  applicationId: application.id,
  kind: 'research_updated',
  occurredAt: application.createdAt,
  recordedAt: application.createdAt,
  deviceId: null,
  payload: { run: 'run-1' },
  revision: 1,
  operationId: 'event:one',
}

const applicationListItem = {
  ...application,
  annualCompensation: null,
  counts: { notes: 1 },
  identityAliases: [],
  labels: ['priority'],
  latestEvent: { kind: event.kind, occurredAt: event.occurredAt },
}

const eventListItem = {
  ...event,
  canonicalUrl: application.canonicalUrl,
  company: application.company,
  role: application.role,
}

const note: ApplicationNote = {
  applicationId: application.id,
  body: 'Follow up',
  createdAt: application.createdAt,
  id: 'note-1',
  kind: 'general',
  source: 'test',
  updatedAt: application.updatedAt,
}

const listingCheck: ApplicationListingCheck = {
  applicationId: application.id,
  checkedAt: application.updatedAt,
  checkerVersion: '1',
  confidence: 'high',
  contentHash: null,
  evidence: [
    {
      code: 'provider_open',
      detail: 'Provider reports the posting as open.',
      sourceUrl: null,
    },
  ],
  finalUrl: application.canonicalUrl,
  httpStatus: 200,
  id: 'listing-check-1',
  nextCheckAt: '2026-07-11T00:00:00.000Z',
  operationId: 'listing-check-operation-1',
  outcome: 'open',
  provider: 'generic',
  receivedAt: application.updatedAt,
  reasonCode: 'provider_open',
  recommendedAction: 'keep',
  requestedUrl: application.canonicalUrl,
  runId: null,
}

const listingCheckRun: ListingCheckRun = {
  checkedCount: 1,
  closedCount: 0,
  completedAt: application.updatedAt,
  errorCount: 0,
  id: 'listing-check-run-1',
  mode: 'report',
  openCount: 1,
  reviewCount: 0,
  selectedCount: 1,
  startedAt: application.createdAt,
  state: 'completed',
  trigger: 'cli',
}

const RegistryAuthorizationClientLayer = HttpApiMiddleware.layerClient(
  RegistryAuthorization,
  ({ next, request: clientRequest }) =>
    next(HttpClientRequest.bearerToken(clientRequest, env.REGISTRY_API_TOKEN))
)

const unsupportedV2ServiceMethod = (..._arguments: readonly unknown[]) =>
  Effect.die(new Error('This v2 service is not used by the legacy HTTP test.'))

const makeRegistryLayer = (
  onNote: (payload: AddApplicationNoteInput) => void = () => undefined,
  onListApplications: (query: ListApplicationsInput) => void = () => undefined,
  onResolveListing: (input: ResolveListingAvailabilityInput) => void = () =>
    undefined,
  failLinkSynchronization = false
) =>
  Layer.mergeAll(
    Layer.succeed(AnnotationsService, {
      addNote: (_identifier, payload) => {
        onNote(payload)
        return Effect.succeed({ note, replayed: false })
      },
      list: () => Effect.succeed({ labels: [], notes: [] }),
    }),
    Layer.succeed(ApplicationsService, {
      create: () => Effect.succeed(application),
      facets: () =>
        Effect.succeed({
          companies: [application.company],
          labels: ['priority'],
        }),
      find: () => Effect.succeed(application),
      list: (query) => {
        onListApplications(query)
        return Effect.succeed({
          items: [applicationListItem],
          pageInfo: {
            kind: 'cursor',
            size: 50,
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
          },
        })
      },
      patch: () => Effect.succeed(application),
      updateManaged: () =>
        Effect.succeed({
          annualCompensation: null,
          application,
          labels: ['priority'],
        }),
      remove: () => Effect.succeed(undefined),
      replaceLabels: () => Effect.succeed([]),
      upsert: () => Effect.succeed(application),
    }),
    Layer.succeed(CompensationsService, {
      listByApplication: () => Effect.succeed({ items: [] }),
      replaceAnnual: () =>
        Effect.succeed({ annualCompensation: null, application }),
    }),
    Layer.succeed(ContentEntriesService, {
      appendRevision: unsupportedV2ServiceMethod,
      approveRevision: unsupportedV2ServiceMethod,
      ensure: unsupportedV2ServiceMethod,
      find: unsupportedV2ServiceMethod,
      listRevisions: unsupportedV2ServiceMethod,
      readRevision: unsupportedV2ServiceMethod,
    }),
    Layer.succeed(CvPublicationsService, {
      disableForApplication: () =>
        failLinkSynchronization
          ? Effect.fail(
              new RegistryDatabaseError({
                cause: new Error('simulated link synchronization failure'),
                message: 'Could not synchronize CV links.',
              })
            )
          : Effect.succeed(0),
      findByEntry: unsupportedV2ServiceMethod,
      publish: unsupportedV2ServiceMethod,
      resolve: unsupportedV2ServiceMethod,
      restoreAfterRejection: () =>
        failLinkSynchronization
          ? Effect.fail(
              new RegistryDatabaseError({
                cause: new Error('simulated link synchronization failure'),
                message: 'Could not synchronize CV links.',
              })
            )
          : Effect.succeed(0),
      setAvailability: unsupportedV2ServiceMethod,
    }),
    Layer.succeed(CvAnalyticsService, {
      read: () =>
        Effect.succeed({
          countries: [{ name: 'DE', visits: 2 }],
          generatedAt: application.updatedAt,
          items: [
            {
              application: {
                appliedAt: application.appliedAt,
                applicationStatus: application.applicationStatus,
                canonicalUrl: application.canonicalUrl,
                company: application.company,
                createdAt: application.createdAt,
                id: application.id,
                listingAvailability: application.listingAvailability,
                role: application.role,
              },
              countries: [{ name: 'DE', visits: 2 }],
              firstSeenOn: '2026-07-10',
              labels: ['priority'],
              lastSeenOn: '2026-07-10',
              link: {
                contentEntryId: 'content-1',
                createdAt: application.createdAt,
                enabled: true,
                id: 'link-1',
                locale: 'en',
                updatedAt: application.updatedAt,
              },
              series: [{ at: '2026-07-10', pageViews: 3, visits: 2 }],
              totals: { pageViews: 3, visits: 2 },
            },
          ],
          range: {
            from: application.createdAt,
            granularity: 'day' as const,
            to: application.updatedAt,
          },
          series: [{ at: '2026-07-10', pageViews: 3, visits: 2 }],
          summary: {
            enabledLinks: 1,
            pageViews: 3,
            publishedLinks: 1,
            unviewedLinks: 0,
            viewedLinks: 1,
            visits: 2,
          },
        }),
    }),
    Layer.succeed(EventsService, {
      append: () => Effect.succeed({ application, event, replayed: false }),
      list: () =>
        Effect.succeed({
          items: [eventListItem],
          pageInfo: {
            kind: 'cursor',
            size: 50,
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
          },
        }),
      listByApplication: () => Effect.succeed({ items: [event] }),
    }),
    Layer.succeed(ListingChecksService, {
      findRun: () => Effect.succeed(listingCheckRun),
      listByApplication: () => Effect.succeed({ items: [listingCheck] }),
      resolveAvailability: (_identifier, input) => {
        onResolveListing(input)
        return Effect.succeed({
          application,
          archived: false,
          check: listingCheck,
          replayed: false,
        })
      },
      runDue: () =>
        Effect.succeed({ checks: [listingCheck], run: listingCheckRun }),
      submitFindings: () =>
        Effect.succeed({
          archivedCount: 0,
          checks: [listingCheck],
          rejected: [],
          replayedCount: 0,
          run: listingCheckRun,
        }),
    }),
    Layer.succeed(JobPostingSnapshotsService, {
      find: unsupportedV2ServiceMethod,
      latest: unsupportedV2ServiceMethod,
      persist: unsupportedV2ServiceMethod,
      readPayload: unsupportedV2ServiceMethod,
    }),
    Layer.succeed(JobPostingCaptureService, {
      capture: unsupportedV2ServiceMethod,
    }),
    Layer.succeed(FactsReleasesService, {
      activate: unsupportedV2ServiceMethod,
      find: unsupportedV2ServiceMethod,
      findActive: unsupportedV2ServiceMethod,
      readActive: unsupportedV2ServiceMethod,
      readActiveAsset: unsupportedV2ServiceMethod,
      readActiveCatalog: unsupportedV2ServiceMethod,
      register: unsupportedV2ServiceMethod,
    }),
    Layer.succeed(OpaqueObjectsService, {
      put: unsupportedV2ServiceMethod,
      read: unsupportedV2ServiceMethod,
    }),
    Layer.succeed(PdfArtifactsService, {
      complete: unsupportedV2ServiceMethod,
      fail: unsupportedV2ServiceMethod,
      findCurrent: unsupportedV2ServiceMethod,
      findJob: unsupportedV2ServiceMethod,
      findPendingDispatch: unsupportedV2ServiceMethod,
      markDispatchFailed: unsupportedV2ServiceMethod,
      markDispatched: unsupportedV2ServiceMethod,
      pendingDispatches: unsupportedV2ServiceMethod,
      readCurrent: unsupportedV2ServiceMethod,
      startJob: unsupportedV2ServiceMethod,
    })
  )

const provideApiTestLayer = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  registryLayer = makeRegistryLayer(),
  authenticated = false
) => {
  const apiLayer = Layer.mergeAll(
    Layer.provide(
      Layer.merge(HealthHandlersLayer, RegistryHandlersLayer),
      Layer.merge(registryLayer, Layer.succeed(WorkerEnv, env))
    ),
    HttpServer.layerServices,
    Layer.succeedContext(makeWorkerRequestContext(env, context))
  )
  const provided = effect.pipe(
    Effect.provide(apiLayer),
    Effect.provide(RegistryAuthorizationLayer)
  )

  return authenticated
    ? provided.pipe(Effect.provide(RegistryAuthorizationClientLayer))
    : provided
}

const runApiTest = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Scope.Scope | HttpRouter.Request<'Requires', unknown>
  >
) =>
  // HttpApiTest executes request-level handler dependencies from the context
  // installed by makeWorkerRequestContext. The router's Request marker is a
  // type-only wrapper, so it is safe to remove once that context is installed.
  Effect.runPromise(Effect.scoped(effect as Effect.Effect<A, E, Scope.Scope>))

describe('application registry HttpApi', () => {
  test('serves the public health endpoint', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'public',
        ])
        return yield* client.health()
      }).pipe(provideApiTestLayer)
    )

    expect(response).toEqual({ ok: true })
  })

  test('serves CV analytics without exposing provider paths', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.getCvAnalytics({ query: { days: 7 } })
      }).pipe((effect) =>
        provideApiTestLayer(effect, makeRegistryLayer(), true)
      )
    )

    expect(response.summary).toEqual(
      expect.objectContaining({ pageViews: 3, visits: 2 })
    )
    expect(JSON.stringify(response)).not.toContain('/c/')
    expect(JSON.stringify(response)).not.toContain('public-token')
  })

  test('decodes the annual compensation replacement command', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.replaceAnnualCompensation({
          params: { id: application.id },
          payload: {
            annualCompensation: {
              currencyCode: 'USD',
              minimumMinor: 15_000_000,
              maximumMinor: 18_000_000,
            },
            expectedVersion: application.version,
          },
        })
      }).pipe((effect) =>
        provideApiTestLayer(effect, makeRegistryLayer(), true)
      )
    )

    expect(response).toEqual({ annualCompensation: null, application })
  })

  test('decodes one managed application update command', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.updateManagedApplication({
          params: { id: application.id },
          payload: {
            annualCompensation: null,
            applicationStatus: 'offer',
            expectedVersion: application.version,
            labels: ['priority'],
            operationId: 'managed-update-1',
          },
        })
      }).pipe((effect) =>
        provideApiTestLayer(effect, makeRegistryLayer(), true)
      )
    )

    expect(response).toEqual({
      annualCompensation: null,
      application,
      labels: ['priority'],
    })
  })

  test('keeps a committed application update successful when derived CV link repair fails', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.patchApplication({
          params: { id: application.id },
          payload: {
            applicationStatus: 'rejected',
            expectedVersion: application.version,
          },
        })
      }).pipe((effect) =>
        provideApiTestLayer(
          effect,
          makeRegistryLayer(undefined, undefined, undefined, true),
          true
        )
      )
    )

    expect(response).toEqual(application)
  })

  test('serves application facets through the static applications route', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.listApplicationFacets()
      }).pipe((effect) =>
        provideApiTestLayer(effect, makeRegistryLayer(), true)
      )
    )

    expect(response).toEqual({
      companies: ['Example'],
      labels: ['priority'],
    })
  })

  test('decodes the definition-derived application query through the HTTP contract', async () => {
    let observed: ListApplicationsInput | undefined
    const query = {
      filters: [
        {
          type: 'group',
          combinator: 'or',
          children: [
            {
              type: 'condition',
              field: 'company',
              operator: 'contains',
              value: 'Example',
            },
            {
              type: 'condition',
              field: 'labels',
              operator: 'hasAny',
              value: ['priority'],
            },
          ],
        },
      ],
      orderBy: [{ field: 'company', direction: 'desc' }],
      pagination: { size: 10 },
    } as const

    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.listApplications({ query })
      }).pipe((effect) =>
        provideApiTestLayer(
          effect,
          makeRegistryLayer(undefined, (input) => {
            observed = input
          }),
          true
        )
      )
    )

    expect(response.items).toEqual([applicationListItem])
    expect(observed).toEqual(query)
  })

  test('carries one note operation ID through the generated HTTP contract', async () => {
    let observed: AddApplicationNoteInput | undefined
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.addApplicationNote({
          params: { id: application.id },
          payload: {
            body: note.body,
            kind: note.kind,
            operationId: 'note-operation-1',
            source: note.source,
          },
        })
      }).pipe((effect) =>
        provideApiTestLayer(
          effect,
          makeRegistryLayer((payload) => {
            observed = payload
          }),
          true
        )
      )
    )

    expect(observed?.operationId).toBe('note-operation-1')
    expect(response).toEqual({ note, replayed: false })
  })

  test('submits locally collected findings through the authenticated contract', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.submitListingCheckFindings({
          payload: {
            expectedCount: 1,
            finalBatch: true,
            findings: [
              {
                applicationId: application.id,
                canonicalUrl: application.canonicalUrl,
                observation: {
                  checkedAt: listingCheck.checkedAt,
                  checkerVersion: listingCheck.checkerVersion,
                  confidence: listingCheck.confidence,
                  contentHash: listingCheck.contentHash,
                  evidence: listingCheck.evidence,
                  finalUrl: listingCheck.finalUrl,
                  httpStatus: listingCheck.httpStatus,
                  outcome: listingCheck.outcome,
                  provider: listingCheck.provider,
                  reasonCode: listingCheck.reasonCode,
                  requestedUrl: listingCheck.requestedUrl,
                },
                operationId: listingCheck.operationId,
                target: {
                  company: application.company,
                  role: application.role,
                  url: application.canonicalUrl,
                },
              },
            ],
            mode: 'report',
            runId: listingCheckRun.id,
            startedAt: listingCheckRun.startedAt,
          },
        })
      }).pipe((effect) =>
        provideApiTestLayer(effect, makeRegistryLayer(), true)
      )
    )

    expect(response.run.trigger).toBe('cli')
    expect(response.checks).toHaveLength(1)
  })

  test('resolves listing availability through the authenticated contract', async () => {
    let observed: ResolveListingAvailabilityInput | undefined
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.resolveApplicationListingAvailability({
          params: { id: application.id },
          payload: {
            expectedVersion: application.version,
            operationId: 'manual-review-1',
            resolution: 'open',
          },
        })
      }).pipe((effect) =>
        provideApiTestLayer(
          effect,
          makeRegistryLayer(undefined, undefined, (input) => {
            observed = input
          }),
          true
        )
      )
    )

    expect(observed).toEqual({
      expectedVersion: application.version,
      operationId: 'manual-review-1',
      resolution: 'open',
    })
    expect(response.application.id).toBe(application.id)
    expect(response.archived).toBe(false)
  })

  test('rejects registry calls without bearer authentication', async () => {
    const exit = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* Effect.exit(
          client.registry.listApplications({ query: {} })
        )
      }).pipe(provideApiTestLayer)
    )

    expect(exit._tag).toBe('Failure')
    expect(exit.toString()).toContain('UnauthorizedError')
  })
})
