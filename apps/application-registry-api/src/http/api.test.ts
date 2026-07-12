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
  ApplicationNote,
  CampaignCapture,
} from '@cv/application-registry-entity'
import {
  type AddApplicationNoteInput,
  AnnotationsService,
  ApplicationsService,
  CapturesService,
  CompensationsService,
  type CreateCampaignCaptureInput,
  EventsService,
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

const capture: CampaignCapture = {
  id: 'capture-1',
  applicationId: application.id,
  campaignRunId: 'run-1',
  profile: 'default',
  audience: null,
  confidence: 0.8,
  submissionDetails: {
    applicationMethod: 'web',
    applicationUrl: 'https://example.test/apply',
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

const request: CreateCampaignCaptureRequest = {
  applicationStatus: application.applicationStatus,
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
  onNote: (payload: AddApplicationNoteInput) => void = () => undefined
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
      find: () => Effect.succeed(application),
      list: () =>
        Effect.succeed({
          checkpoint: 'revision=1',
          items: [application],
          nextCursor: null,
        }),
      patch: () => Effect.succeed(application),
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
    }),
    Layer.succeed(EventsService, {
      append: () => Effect.succeed({ application, event, replayed: false }),
      list: () =>
        Effect.succeed({
          checkpoint: 'revision=1',
          items: [event],
          nextCursor: null,
        }),
      listByApplication: () => Effect.succeed({ items: [event] }),
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
