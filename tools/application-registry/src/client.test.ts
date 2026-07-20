import { describe, expect, test } from 'bun:test'
import { makeApplicationRegistryHttpClientLayer } from '@cv/application-registry-api-client'
import type {
  AddApplicationNoteRequest,
  UpdateApplicationResponse,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ApplicationActivity,
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

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  company: 'Example',
  createdAt: '2026-07-10T00:00:00.000Z',
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
  updatedAt: '2026-07-10T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const activity: ApplicationActivity = {
  actor: 'system',
  applicationId: application.id,
  id: 'activity-1',
  kind: 'application_created',
  occurredAt: application.createdAt,
  payload: {},
  revision: 1,
  source: 'management',
}

const note: ApplicationNote = {
  applicationId: application.id,
  body: 'Follow up',
  createdAt: application.createdAt,
  id: 'note-1',
  kind: 'general',
  source: 'application-registry-cli',
  updatedAt: application.createdAt,
}

const noteRequest: AddApplicationNoteRequest = {
  body: note.body,
  kind: note.kind,
  source: note.source,
}

const makeFetch = (
  respond: (request: Request) => Promise<Response>
): typeof globalThis.fetch =>
  Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) =>
      respond(new Request(input, init)),
    { preconnect: globalThis.fetch.preconnect }
  )

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
      baseUrl: new URL('https://registry.example.test/machine/'),
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
  test('uses the unversioned registry routes and idempotency headers', async () => {
    const requests: Request[] = []
    const updated: UpdateApplicationResponse = {
      annualCompensation: null,
      application: { ...application, company: 'Updated', version: 2 },
      labels: [],
    }
    const fetch = makeFetch(async (request) => {
      requests.push(request)
      if (request.method === 'POST') {
        return Response.json(application, { status: 201 })
      }
      if (request.method === 'PATCH') return Response.json(updated)
      if (request.url.endsWith('/activities')) {
        return Response.json({ items: [activity] })
      }
      return Response.json({ ok: true })
    })

    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        Effect.gen(function* () {
          const client = yield* ApplicationRegistryClient
          const created = yield* client.create({
            company: application.company,
            location: application.location,
            postingUrl: application.postingUrl,
            role: application.role,
          })
          const changed = yield* client.update(application.id, 'update-key', {
            company: 'Updated',
            expectedVersion: 1,
          })
          const activities = yield* client.activities(application.id)
          const health = yield* client.health()
          return { activities, changed, created, health }
        })
      )
    )

    expect(result.created).toEqual(application)
    expect(result.changed).toEqual(updated)
    expect(result.activities.items).toEqual([activity])
    expect(result.health).toEqual({ ok: true })
    expect(requests.map(({ method, url }) => ({ method, url }))).toEqual([
      {
        method: 'POST',
        url: 'https://registry.example.test/machine/api/registry/applications',
      },
      {
        method: 'PATCH',
        url: 'https://registry.example.test/machine/api/registry/applications/application-1',
      },
      {
        method: 'GET',
        url: 'https://registry.example.test/machine/api/registry/applications/application-1/activities',
      },
      { method: 'GET', url: 'https://registry.example.test/machine/health' },
    ])
    expect(requests[1]?.headers.get('idempotency-key')).toBe('update-key')
  })

  test('sends note idempotency in a header and removes it from the body', async () => {
    let captured: Request | undefined
    const fetch = makeFetch(async (request) => {
      captured = request
      return Response.json({ note, replayed: false }, { status: 201 })
    })
    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        ApplicationRegistryClient.pipe(
          Effect.flatMap((client) =>
            client.addNote(application.id, 'note-key', noteRequest)
          )
        )
      )
    )

    expect(result.status).toBe('synced')
    expect(captured?.headers.get('idempotency-key')).toBe('note-key')
    expect(captured ? await captured.clone().json() : null).toEqual(noteRequest)
  })

  test('queues retryable note writes and replays the same command', async () => {
    let requests = 0
    const fetch = makeFetch(async () => {
      requests += 1
      if (requests <= 3) throw new TypeError('offline')
      return Response.json({ note, replayed: true }, { status: 201 })
    })
    const result = await Effect.runPromise(
      withTemporaryOutbox(
        fetch,
        Effect.gen(function* () {
          const client = yield* ApplicationRegistryClient
          const write = yield* client.addNote(
            application.id,
            'note-replay-key',
            noteRequest
          )
          const sync = yield* client.sync()
          const retained = yield* client.outbox()
          return { retained, sync, write }
        })
      )
    )

    expect(result.write.status).toBe('queued')
    expect(result.sync).toMatchObject({ attempted: 1, failed: [], synced: 1 })
    expect(result.retained).toEqual([])
    expect(requests).toBe(4)
  })
})
