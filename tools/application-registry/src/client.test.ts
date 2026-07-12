import { describe, expect, test } from 'bun:test'
import { makeApplicationRegistryHttpClientLayer } from '@cv/application-registry-api-client'
import type {
  AddApplicationNoteRequest,
  AppendApplicationEventRequest,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ApplicationCompensation,
  ApplicationEvent,
  ApplicationNote,
} from '@cv/application-registry-entity'
import { BunServices } from '@effect/platform-bun'
import { Effect, Layer, Redacted } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import {
  ApplicationRegistryClient,
  ApplicationRegistryClientLive,
} from './client'
import { makeRegistryOutboxLayer } from './outbox'

const eventRequest = (): AppendApplicationEventRequest => ({
  deviceId: 'test',
  expectedVersion: null,
  kind: 'stage_changed',
  nextApplicationStatus: 'applied',
  occurredAt: '2026-07-10T00:00:00.000Z',
  operationId: 'operation-1',
  payload: { applicationStatus: 'applied' },
})

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  canonicalUrl: 'https://example.test/jobs/one',
  category: null,
  company: 'Example',
  createdAt: '2026-07-10T00:00:00.000Z',
  details: null,
  fitScore: null,
  followUpAt: null,
  id: 'application-1',
  jobKey: 'web:one',
  lastContactAt: null,
  location: null,
  openStatus: null,
  personalPriority: null,
  recommendedAction: null,
  remotePolicy: null,
  researchPriority: null,
  role: 'Engineer',
  source: 'web',
  sourceConfidence: null,
  sourceJobId: null,
  targetStage: 'backlog',
  technologyStack: null,
  updatedAt: '2026-07-10T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const event: ApplicationEvent = {
  applicationId: application.id,
  deviceId: 'test',
  id: 'event-1',
  operationId: 'operation-1',
  kind: 'stage_changed',
  occurredAt: '2026-07-10T00:00:00.000Z',
  payload: { applicationStatus: 'applied' },
  recordedAt: '2026-07-10T00:00:00.000Z',
  revision: 1,
}

const note: ApplicationNote = {
  applicationId: application.id,
  body: 'Follow up',
  createdAt: '2026-07-10T00:00:00.000Z',
  id: 'note-1',
  kind: 'general',
  source: 'application-registry-cli',
  updatedAt: '2026-07-10T00:00:00.000Z',
}

const compensation: ApplicationCompensation = {
  applicationId: application.id,
  createdAt: '2026-07-10T00:00:00.000Z',
  currencyCode: 'JPY',
  id: 'compensation-1',
  kind: 'base_salary',
  maximumMinor: 12_000_000,
  minimumMinor: 8_000_000,
  period: 'year',
  rawText: 'JPY 8–12M',
  source: 'job-board',
  updatedAt: '2026-07-10T00:00:00.000Z',
}

const noteRequest = (): AddApplicationNoteRequest => ({
  body: note.body,
  kind: note.kind,
  operationId: 'note-operation-1',
  source: note.source,
})

const noteSuccessResponse = (replayed: boolean) =>
  Promise.resolve(Response.json({ note, replayed }))

const successResponse = () =>
  Promise.resolve(
    Response.json({ application, event, replayed: false }, { status: 200 })
  )

const jsonError = (status: number, message: string) =>
  Promise.resolve(Response.json({ message }, { status }))

const makeFetch = (
  respond: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): typeof globalThis.fetch =>
  Object.assign(respond, { preconnect: globalThis.fetch.preconnect })

const withClient = <A, E>(
  root: string,
  fetch: typeof globalThis.fetch,
  effect: Effect.Effect<A, E, ApplicationRegistryClient>
) => {
  const fetchLayer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))
  )
  const platformLayer = Layer.merge(BunServices.layer, fetchLayer)
  const dependencies = Layer.merge(
    makeApplicationRegistryHttpClientLayer({
      baseUrl: new URL('https://registry.example.test'),
      token: Redacted.make('test-token'),
    }),
    makeRegistryOutboxLayer(root)
  ).pipe(Layer.provide(platformLayer))
  return effect.pipe(
    Effect.provide(
      ApplicationRegistryClientLive.pipe(Layer.provide(dependencies))
    )
  )
}

const withTemporaryOutbox = <A, E>(
  fetch: typeof globalThis.fetch,
  use: Effect.Effect<A, E, ApplicationRegistryClient>
) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem
    const root = yield* fileSystem.makeTempDirectory()
    return yield* withClient(root, fetch, use).pipe(
      Effect.ensuring(
        fileSystem
          .remove(root, { force: true, recursive: true })
          .pipe(Effect.ignore)
      )
    )
  }).pipe(Effect.provide(BunServices.layer))

describe('application registry client', () => {
  test('lists converted compensation through the generated endpoint', async () => {
    let requestedUrl = ''
    let requestMethod = ''
    const response = {
      items: [
        {
          conversion: {
            currencyCode: 'USD',
            maximumMinor: 8_160_000,
            minimumMinor: 5_440_000,
            observedAt: '2026-07-10T00:00:00.000Z',
            provider: 'frankfurter',
            rate: 0.0068,
          },
          original: compensation,
        },
      ],
    }
    const fetch = makeFetch((input, init) => {
      requestedUrl = String(input)
      requestMethod = init?.method ?? ''
      return Promise.resolve(Response.json(response))
    })

    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        ApplicationRegistryClient.pipe(
          Effect.flatMap((client) =>
            client.compensations(application.id, { currency: 'USD' })
          )
        )
      )
    )

    expect(result).toEqual(response)
    expect(requestedUrl).toBe(
      'https://registry.example.test/v1/applications/application-1/compensations?currency=USD'
    )
    expect(requestMethod).toBe('GET')
  })

  test('writes first-class notes through the generated annotation endpoint', async () => {
    let requestedUrl = ''
    let requestMethod = ''
    const fetch = makeFetch((input, init) => {
      requestedUrl = String(input)
      requestMethod = init?.method ?? ''
      return noteSuccessResponse(false)
    })

    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        ApplicationRegistryClient.pipe(
          Effect.flatMap((client) =>
            client.addNote(application.id, noteRequest())
          )
        )
      )
    )

    expect(result).toEqual({
      response: { note, replayed: false },
      status: 'synced',
    })
    expect(requestedUrl).toBe(
      'https://registry.example.test/v1/applications/application-1/notes'
    )
    expect(requestMethod).toBe('POST')
  })

  test('retains an offline note for a later replay', async () => {
    let requests = 0
    const fetch = makeFetch(() => {
      requests += 1
      return Promise.reject(new TypeError('offline'))
    })

    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        Effect.gen(function* () {
          const client = yield* ApplicationRegistryClient
          const write = yield* client.addNote(application.id, noteRequest())
          const sync = yield* client.sync()
          return { sync, write }
        })
      )
    )

    expect(result.write.status).toBe('queued')
    expect(result.sync).toMatchObject({
      attempted: 1,
      failed: [{ disposition: 'retry', operationId: 'note-operation-1' }],
      retainedSynced: 0,
      synced: 0,
    })
    expect(requests).toBe(6)
  })

  test('replays the same note operation after the original response is lost', async () => {
    let requests = 0
    const operationIds: string[] = []
    const fetch = makeFetch((_input, init) => {
      requests += 1
      const body = init?.body
      const bodyText =
        typeof body === 'string'
          ? body
          : body instanceof Uint8Array
            ? new TextDecoder().decode(body)
            : null
      if (bodyText !== null) {
        const parsed: unknown = JSON.parse(bodyText)
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'operationId' in parsed &&
          typeof parsed.operationId === 'string'
        ) {
          operationIds.push(parsed.operationId)
        }
      }
      return requests <= 3
        ? Promise.reject(new TypeError('response lost'))
        : noteSuccessResponse(true)
    })

    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        Effect.gen(function* () {
          const client = yield* ApplicationRegistryClient
          const write = yield* client.addNote(application.id, noteRequest())
          const sync = yield* client.sync()
          return { sync, write }
        })
      )
    )

    expect(result.write.status).toBe('queued')
    expect(result.sync).toMatchObject({
      attempted: 1,
      failed: [],
      retainedSynced: 1,
      synced: 1,
    })
    expect(operationIds).toEqual([
      'note-operation-1',
      'note-operation-1',
      'note-operation-1',
      'note-operation-1',
    ])
  })

  test('queues retryable writes and later replays them', async () => {
    let requests = 0
    const fetch = makeFetch(() => {
      requests += 1
      return requests <= 3
        ? Promise.reject(new TypeError('offline'))
        : successResponse()
    })
    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        Effect.gen(function* () {
          const client = yield* ApplicationRegistryClient
          const write = yield* client.appendEvent(
            application.id,
            eventRequest()
          )
          const sync = yield* client.sync()
          const empty = yield* client.sync()
          return { empty, sync, write }
        })
      )
    )

    expect(result.write.status).toBe('queued')
    expect(result.sync).toEqual({
      attempted: 1,
      blocked: 0,
      deadLetter: 0,
      failed: [],
      retainedSynced: 1,
      synced: 1,
    })
    expect(result.empty).toEqual({
      attempted: 0,
      blocked: 0,
      deadLetter: 0,
      failed: [],
      retainedSynced: 1,
      synced: 0,
    })
    expect(requests).toBe(4)
  })

  test('retains non-retryable HTTP failures as dead letters', async () => {
    const fetch = makeFetch(() => jsonError(409, 'conflict'))
    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        ApplicationRegistryClient.pipe(
          Effect.flatMap((client) =>
            client
              .appendEvent(application.id, eventRequest())
              .pipe(Effect.result)
          ),
          Effect.flatMap((write) =>
            ApplicationRegistryClient.pipe(
              Effect.flatMap((client) => client.sync()),
              Effect.map((sync) => ({ sync, write }))
            )
          )
        )
      )
    )

    expect(result.write._tag).toBe('Failure')
    expect(result.sync).toMatchObject({ attempted: 0, deadLetter: 1 })
  })

  test('blocks authentication failures until configuration changes', async () => {
    const fetch = makeFetch(() =>
      Promise.resolve(
        Response.json(
          { code: 'unauthorized', message: 'invalid token' },
          { status: 401 }
        )
      )
    )
    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        ApplicationRegistryClient.pipe(
          Effect.flatMap((client) =>
            client
              .appendEvent(application.id, eventRequest())
              .pipe(Effect.result)
          ),
          Effect.flatMap((write) =>
            ApplicationRegistryClient.pipe(
              Effect.flatMap((client) => client.sync()),
              Effect.map((sync) => ({ sync, write }))
            )
          )
        )
      )
    )

    expect(result.write._tag).toBe('Failure')
    expect(result.sync).toMatchObject({ attempted: 0, blocked: 1 })
  })

  test('dead-letters non-retryable replay failures without deleting them', async () => {
    let requests = 0
    const fetch = makeFetch(() => {
      requests += 1
      return requests <= 3
        ? Promise.reject(new TypeError('offline'))
        : jsonError(409, 'conflict')
    })
    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        Effect.gen(function* () {
          const client = yield* ApplicationRegistryClient
          yield* client.appendEvent(application.id, eventRequest())
          const failed = yield* client.sync()
          const empty = yield* client.sync()
          return { empty, failed }
        })
      )
    )

    expect(result.failed.attempted).toBe(1)
    expect(result.failed.synced).toBe(0)
    expect(result.failed.failed).toHaveLength(1)
    expect(result.failed.deadLetter).toBe(1)
    expect(result.empty).toMatchObject({ attempted: 0, deadLetter: 1 })
  })

  test('retains retryable replay failures for a later sync', async () => {
    let requests = 0
    const fetch = makeFetch(() => {
      requests += 1
      return jsonError(503, 'unavailable')
    })
    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        Effect.gen(function* () {
          const client = yield* ApplicationRegistryClient
          yield* client.appendEvent(application.id, eventRequest())
          const first = yield* client.sync()
          const second = yield* client.sync()
          return { first, second }
        })
      )
    )

    expect(result.first.attempted).toBe(1)
    expect(result.first.failed).toHaveLength(1)
    expect(result.second.attempted).toBe(1)
    expect(result.second.failed).toHaveLength(1)
    expect(requests).toBe(9)
  })
})
