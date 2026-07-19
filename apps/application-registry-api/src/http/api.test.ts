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
  ApplicationActivity,
  ApplicationListingCheck,
  ApplicationNote,
  ListingCheckRun,
} from '@cv/application-registry-entity'
import {
  ActivitiesService,
  type AddApplicationNoteInput,
  AnnotationsService,
  ApplicationsService,
  CompensationsService,
  ContentEntriesService,
  CvAnalyticsService,
  CvPublicationsService,
  JobPostingCaptureService,
  JobPostingSnapshotsService,
  type ListApplicationsInput,
  ListingChecksService,
  OpaqueObjectsService,
  PdfArtifactsService,
  type ResolveListingAvailabilityInput,
  type SubmitListingCheckFindingsInput,
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
import { RegistryHandlersLayers } from './handlers/registry'
import { RegistryAuthorizationLayer } from './middleware/auth'

const timestamp = '2026-07-10T00:00:00.000Z'
const context: WorkerExecutionContext = { waitUntil: () => undefined }
const env = {
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
  company: 'Example',
  createdAt: timestamp,
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'unchecked',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  postingUrl: 'https://example.test/jobs/one',
  role: 'Engineer',
  targetStage: 'backlog',
  updatedAt: timestamp,
  updatedRevision: 1,
  version: 1,
}

const activity: ApplicationActivity = {
  actor: 'system',
  applicationId: application.id,
  id: 'activity-1',
  kind: 'application_created',
  occurredAt: timestamp,
  payload: {},
  revision: 1,
  source: 'management',
}

const note: ApplicationNote = {
  applicationId: application.id,
  body: 'Follow up',
  createdAt: timestamp,
  id: 'note-1',
  kind: 'general',
  source: 'test',
  updatedAt: timestamp,
}

const listingCheck: ApplicationListingCheck = {
  applicationId: application.id,
  checkedAt: timestamp,
  checkerVersion: '1',
  confidence: 'high',
  contentHash: null,
  evidence: [],
  finalUrl: application.postingUrl,
  httpStatus: 200,
  id: 'check-1',
  nextCheckAt: timestamp,
  operationId: 'check-operation-1',
  outcome: 'open',
  provider: 'test',
  reasonCode: 'provider_open',
  receivedAt: timestamp,
  recommendedAction: 'keep',
  requestedUrl: application.postingUrl,
  runId: 'run-1',
}

const listingRun: ListingCheckRun = {
  checkedCount: 1,
  closedCount: 0,
  completedAt: timestamp,
  errorCount: 0,
  id: 'run-1',
  mode: 'report',
  openCount: 1,
  reviewCount: 0,
  selectedCount: 1,
  startedAt: timestamp,
  state: 'completed',
  trigger: 'cli',
}

const unsupported = (..._arguments: readonly unknown[]) =>
  Effect.die(new Error('Unexpected service call.'))

type Observers = {
  note?: (input: AddApplicationNoteInput) => void
  list?: (input: ListApplicationsInput) => void
  resolve?: (input: ResolveListingAvailabilityInput) => void
  submit?: (input: SubmitListingCheckFindingsInput) => void
  update?: (idempotencyKey: string) => void
}

const makeServices = (observers: Observers = {}) => {
  const blob = new Uint8Array([1, 2, 3])
  const digest = 'a'.repeat(64)

  return Layer.mergeAll(
    Layer.succeed(ActivitiesService, {
      list: () =>
        Effect.succeed({
          items: [
            {
              ...activity,
              company: application.company,
              postingUrl: application.postingUrl,
              role: application.role,
            },
          ],
          pageInfo: {
            kind: 'cursor',
            size: 50,
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
          },
        }),
      listByApplication: () => Effect.succeed({ items: [activity] }),
    }),
    Layer.succeed(AnnotationsService, {
      addNote: (_identifier, input) => {
        observers.note?.(input)
        return Effect.succeed({ note, replayed: false })
      },
      list: () => Effect.succeed({ labels: [], notes: [note] }),
    }),
    Layer.succeed(ApplicationsService, {
      create: () => Effect.succeed(application),
      facets: () => Effect.succeed({ companies: ['Example'], labels: [] }),
      find: () => Effect.succeed(application),
      list: (input) => {
        observers.list?.(input)
        return Effect.succeed({
          items: [
            {
              ...application,
              annualCompensation: null,
              counts: { notes: 1 },
              labels: [],
              latestActivity: activity,
            },
          ],
          pageInfo: {
            kind: 'cursor',
            size: 50,
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
          },
        })
      },
      remove: () => Effect.void,
      update: (_identifier, input) => {
        observers.update?.(input.idempotencyKey)
        return Effect.succeed({
          annualCompensation: null,
          application,
          labels: [],
        })
      },
    }),
    Layer.succeed(CompensationsService, {
      listByApplication: () => Effect.succeed({ items: [] }),
      replaceAnnual: unsupported,
    }),
    Layer.succeed(CvAnalyticsService, { read: unsupported }),
    Layer.succeed(CvPublicationsService, {
      disableForApplication: () => Effect.succeed(0),
      findByEntry: unsupported,
      resolve: unsupported,
      resolvePreview: unsupported,
      restoreAfterRejection: () => Effect.succeed(0),
      setAvailability: unsupported,
      stage: unsupported,
    }),
    Layer.succeed(ListingChecksService, {
      findRun: () => Effect.succeed(listingRun),
      listByApplication: () => Effect.succeed({ items: [listingCheck] }),
      resolveAvailability: (_identifier, input) => {
        observers.resolve?.(input)
        return Effect.succeed({
          application,
          archived: false,
          check: listingCheck,
          replayed: false,
        })
      },
      runDue: unsupported,
      submitFindings: (input) => {
        observers.submit?.(input)
        return Effect.succeed({
          archivedCount: 0,
          checks: [listingCheck],
          rejected: [],
          replayedCount: 0,
          run: listingRun,
        })
      },
    }),
    Layer.succeed(OpaqueObjectsService, {
      put: (bytes) =>
        Effect.succeed({
          byteLength: bytes.byteLength,
          key: `sha256/${digest}`,
          sha256: digest,
        }),
      read: () => Effect.succeed(blob),
    }),
    Layer.succeed(ContentEntriesService, {
      appendRevision: unsupported,
      approveRevision: unsupported,
      ensure: unsupported,
      find: unsupported,
      listRevisions: unsupported,
      readRevision: unsupported,
    }),
    Layer.succeed(JobPostingCaptureService, { capture: unsupported }),
    Layer.succeed(JobPostingSnapshotsService, {
      find: unsupported,
      latest: unsupported,
      persist: unsupported,
      readPayload: unsupported,
    }),
    Layer.succeed(PdfArtifactsService, {
      complete: unsupported,
      fail: unsupported,
      findCurrent: unsupported,
      findJob: unsupported,
      findPendingDispatch: unsupported,
      markDispatchFailed: unsupported,
      markDispatched: unsupported,
      pendingDispatches: unsupported,
      readCurrent: unsupported,
      startJob: unsupported,
    })
  )
}

const authorizationClient = HttpApiMiddleware.layerClient(
  RegistryAuthorization,
  ({ next, request }) =>
    next(HttpClientRequest.bearerToken(request, env.REGISTRY_API_TOKEN))
)

const provideApi = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  services = makeServices(),
  authenticated = false
) => {
  const handlerLayers = Layer.mergeAll(
    HealthHandlersLayer,
    ...RegistryHandlersLayers
  )
  const layer = Layer.mergeAll(
    Layer.provide(
      handlerLayers,
      Layer.merge(services, Layer.succeed(WorkerEnv, env))
    ),
    HttpServer.layerServices,
    Layer.succeedContext(makeWorkerRequestContext(env, context))
  )
  const provided = effect.pipe(
    Effect.provide(layer),
    Effect.provide(RegistryAuthorizationLayer)
  )
  return authenticated
    ? provided.pipe(Effect.provide(authorizationClient))
    : provided
}

const runApi = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Scope.Scope | HttpRouter.Request<'Requires', unknown>
  >
) =>
  Effect.runPromise(Effect.scoped(effect as Effect.Effect<A, E, Scope.Scope>))

describe('application registry HttpApi', () => {
  test('serves the public health endpoint', async () => {
    const response = await runApi(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'public',
        ])
        return yield* client.health()
      }).pipe(provideApi)
    )
    expect(response).toEqual({ ok: true })
  })

  test('keeps the drizzle-query list request intact', async () => {
    let observed: ListApplicationsInput | undefined
    const query = {
      filters: [
        {
          type: 'condition',
          field: 'company',
          operator: 'contains',
          value: 'Example',
        },
      ],
      orderBy: [{ field: 'company', direction: 'desc' }],
      pagination: { size: 10 },
    } as const
    const response = await runApi(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'applications',
        ])
        return yield* client.applications.listApplications({ query })
      }).pipe((effect) =>
        provideApi(
          effect,
          makeServices({
            list: (input) => {
              observed = input
            },
          }),
          true
        )
      )
    )
    expect(observed).toEqual(query)
    expect(response.items[0]?.id).toBe(application.id)
  })

  test('takes mutation idempotency from the HTTP header', async () => {
    let updateKey: string | undefined
    let noteInput: AddApplicationNoteInput | undefined
    await runApi(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'applications',
        ])
        yield* client.applications.updateApplication({
          headers: { 'idempotency-key': 'update-1' },
          params: { id: application.id },
          payload: { applicationStatus: 'offer', expectedVersion: 1 },
        })
        return yield* client.applications.addApplicationNote({
          headers: { 'idempotency-key': 'note-1' },
          params: { id: application.id },
          payload: { body: note.body, kind: note.kind, source: note.source },
        })
      }).pipe((effect) =>
        provideApi(
          effect,
          makeServices({
            note: (input) => {
              noteInput = input
            },
            update: (key) => {
              updateKey = key
            },
          }),
          true
        )
      )
    )
    expect(updateKey).toBe('update-1')
    expect(noteInput?.idempotencyKey).toBe('note-1')
  })

  test('transports opaque objects as bytes and checks the digest path', async () => {
    const digest = 'a'.repeat(64)
    const result = await runApi(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'content',
        ])
        const stored = yield* client.content.putBlob({
          params: { sha256: digest },
          payload: new Uint8Array([1, 2, 3]),
        })
        const bytes = yield* client.content.getBlob({
          params: { sha256: digest },
        })
        return { bytes, stored }
      }).pipe((effect) => provideApi(effect, makeServices(), true))
    )
    expect(result.stored).toEqual({ byteLength: 3, sha256: digest })
    expect([...result.bytes]).toEqual([1, 2, 3])
  })

  test('uses the automation run resource from the path', async () => {
    let observed: SubmitListingCheckFindingsInput | undefined
    await runApi(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'automation',
        ])
        return yield* client.automation.submitListingCheckFindings({
          params: { runId: listingRun.id },
          payload: {
            expectedCount: 0,
            finalBatch: true,
            findings: [],
            mode: 'report',
            startedAt: timestamp,
          },
        })
      }).pipe((effect) =>
        provideApi(
          effect,
          makeServices({
            submit: (input) => {
              observed = input
            },
          }),
          true
        )
      )
    )
    expect(observed?.runId).toBe(listingRun.id)
  })

  test('rejects registry calls without bearer authentication', async () => {
    const exit = await runApi(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(ApplicationRegistryApi, [
          'applications',
        ])
        return yield* Effect.exit(
          client.applications.listApplications({ query: {} })
        )
      }).pipe(provideApi)
    )
    expect(exit._tag).toBe('Failure')
    expect(exit.toString()).toContain('UnauthorizedError')
  })
})
