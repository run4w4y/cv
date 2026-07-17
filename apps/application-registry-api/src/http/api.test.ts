import { describe, expect, test } from 'bun:test'
import type { D1Database } from '@cloudflare/workers-types'
import {
  ApplicationRegistryApi,
  type CreateCampaignCaptureRequest,
  RegistryAuthorization,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ApplicationEvent,
  ApplicationListingCheck,
  ApplicationNote,
  CampaignCapture,
  ListingCheckRun,
} from '@cv/application-registry-entity'
import {
  type AddApplicationNoteInput,
  AnnotationsService,
  ApplicationsService,
  CapturesService,
  CompensationsService,
  type CreateCampaignCaptureInput,
  EventsService,
  type ListApplicationsInput,
  ListingChecksService,
  type ResolveListingAvailabilityInput,
} from '@cv/application-registry-service'
import { Effect, Layer, type Scope } from 'effect'
import { HttpClientRequest, HttpServer } from 'effect/unstable/http'
import { HttpApiMiddleware, HttpApiTest } from 'effect/unstable/httpapi'

import { makeWorkerRequestContext } from '../worker/bindings'
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
  REGISTRY_API_TOKEN: 'test-token',
} satisfies ApplicationRegistryEnv

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  id: 'application-1',
  category: null,
  jobKey: 'web:one',
  source: 'web',
  sourceJobId: null,
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  details: null,
  fitScore: null,
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
  openStatus: null,
  personalPriority: null,
  recommendedAction: null,
  remotePolicy: null,
  researchPriority: null,
  sourceConfidence: null,
  targetStage: 'backlog',
  technologyStack: null,
  version: 1,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
  updatedRevision: 1,
}

const event: ApplicationEvent = {
  id: 'event-1',
  applicationId: application.id,
  kind: 'campaign_prepared',
  occurredAt: application.createdAt,
  recordedAt: application.createdAt,
  deviceId: null,
  payload: { run: 'run-1' },
  revision: 1,
  operationId: 'capture:one',
}

const applicationListItem = {
  ...application,
  annualCompensation: null,
  counts: { captures: 1, notes: 1 },
  identityAliases: [],
  labels: ['priority'],
  latestCapture: { applicationUrl: 'https://example.test/apply' },
  latestEvent: { kind: event.kind, occurredAt: event.occurredAt },
}

const eventListItem = {
  ...event,
  canonicalUrl: application.canonicalUrl,
  company: application.company,
  role: application.role,
}

const capture: CampaignCapture = {
  id: 'capture-1',
  applicationId: application.id,
  campaignRunId: 'run-1',
  profile: 'default',
  audience: null,
  applicationUrl: 'https://example.test/apply',
  confidence: 0.8,
  fitAssessment: null,
  submissionDetails: {
    applicationMethod: 'web',
    contactEmail: null,
    deadline: null,
    employmentType: null,
    workMode: null,
    locationRestrictions: null,
    salary: null,
    visaRequirements: null,
    relocation: null,
    languageRequirements: [],
    requiredDocuments: [],
    applicationQuestions: ['Why us?'],
    coverLetterInstructions: null,
    additionalInstructions: null,
  },
  artifacts: [],
  jobContentHash: null,
  capturedAt: application.createdAt,
  operationId: 'capture:one',
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

const request: CreateCampaignCaptureRequest = {
  applicationStatus: application.applicationStatus,
  applicationUrl: capture.applicationUrl,
  jobKey: application.jobKey,
  source: application.source,
  sourceJobId: null,
  canonicalUrl: application.canonicalUrl,
  company: application.company,
  role: application.role,
  location: null,
  targetStage: application.targetStage,
  campaignRunId: capture.campaignRunId,
  profile: capture.profile,
  audience: null,
  confidence: capture.confidence,
  submissionDetails: capture.submissionDetails,
  artifacts: [],
  jobContentHash: null,
  capturedAt: capture.capturedAt,
  deviceId: null,
  operationId: 'operation-1',
}

const RegistryAuthorizationClientLayer = HttpApiMiddleware.layerClient(
  RegistryAuthorization,
  ({ next, request: clientRequest }) =>
    next(HttpClientRequest.bearerToken(clientRequest, env.REGISTRY_API_TOKEN))
)

const makeRegistryLayer = (
  onCapture: (payload: CreateCampaignCaptureInput) => void = () => undefined,
  onNote: (payload: AddApplicationNoteInput) => void = () => undefined,
  onListApplications: (query: ListApplicationsInput) => void = () => undefined,
  onResolveListing: (input: ResolveListingAvailabilityInput) => void = () =>
    undefined
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
    Layer.succeed(CapturesService, {
      capture: (payload) => {
        onCapture(payload)
        return Effect.succeed({ application, capture, replayed: false })
      },
      listByApplication: () => Effect.succeed({ items: [capture] }),
    }),
    Layer.succeed(CompensationsService, {
      listByApplication: () => Effect.succeed({ items: [] }),
      replaceAnnual: () =>
        Effect.succeed({ annualCompensation: null, application }),
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
      registryLayer
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

const runApiTest = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) =>
  Effect.runPromise(Effect.scoped(effect))

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

  test('keeps extension data as native nested JSON through the HTTP codec', async () => {
    let observed: CreateCampaignCaptureInput | undefined
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.createCapture({ payload: request })
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

    expect(response.application).toEqual(application)
    expect(observed?.submissionDetails.applicationQuestions).toEqual([
      'Why us?',
    ])
  })

  test('returns persisted campaign capture details', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'registry',
        ])
        return yield* client.registry.listApplicationCaptures({
          params: { id: application.id },
        })
      }).pipe((effect) =>
        provideApiTestLayer(effect, makeRegistryLayer(), true)
      )
    )

    expect(response.items[0]?.submissionDetails.applicationQuestions).toEqual([
      'Why us?',
    ])
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
          makeRegistryLayer(undefined, undefined, (input) => {
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
          makeRegistryLayer(undefined, (payload) => {
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
          makeRegistryLayer(undefined, undefined, undefined, (input) => {
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
