import type { D1Database } from '@cloudflare/workers-types'
import type { FxRate } from '@cv/application-registry-entity'
import { Effect, Layer } from 'effect'
import { RegistryCrudD1Live, registryDatabaseD1Layer } from '../src/d1/index'
import {
  AnnotationsCrud,
  ApplicationsCrud,
  FxRatesCrud,
  type PersistedApplication,
  type PersistedEvent,
  type PersistedNote,
} from '../src/index'

type Env = { readonly APPLICATION_REGISTRY_DB: D1Database }

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
  recordedAt,
  requestFingerprint: 'crud-note-fingerprint',
  source: 'crud-test',
})

const fxRate: FxRate = {
  baseCurrency: 'USD',
  fetchedAt: recordedAt,
  observedAt: '2026-07-12T00:00:00.000Z',
  provider: 'crud-test',
  quoteCurrency: 'EUR',
  rate: 0.91,
}

const event = (sequence: number): PersistedEvent => ({
  deviceId: null,
  eventId: `crud-event-${sequence}`,
  kind: 'research_updated',
  occurredAt: recordedAt,
  operationId: `crud-event-operation-${sequence}`,
  payload: { sequence },
  recordedAt,
  requestFingerprint: `crud-event-fingerprint-${sequence}`,
})

const program = (pathname: string) =>
  Effect.gen(function* () {
    const annotations = yield* AnnotationsCrud
    const applications = yield* ApplicationsCrud
    const fxRates = yield* FxRatesCrud

    switch (pathname) {
      case '/applications/seed':
        yield* applications.persist(application, {
          mode: 'replace',
          operation: 'CRUD integration application seed',
        })
        return yield* applications.findByIdentifier(application.applicationId)
      case '/applications/patch':
        return yield* applications.patch(
          application.applicationId,
          { category: null, expectedVersion: 1, fitScore: 42 },
          '2026-07-12T13:00:00.000Z'
        )
      case '/applications/list':
        return yield* applications.list({ limit: 10 })
      case '/applications/remove':
        return yield* applications.remove(application.applicationId)
      case '/events/no-status':
        yield* applications.persistEvent(
          application.applicationId,
          1,
          undefined,
          event(1)
        )
        return yield* applications.findByIdentifier(application.applicationId)
      case '/events/with-status':
        yield* applications.persistEvent(
          application.applicationId,
          2,
          'applied',
          event(2)
        )
        return yield* applications.findByIdentifier(application.applicationId)
      case '/notes/first':
        yield* annotations.persistNote(
          application.applicationId,
          note('crud-note-1')
        )
        return yield* annotations.findNote('crud-note-1')
      case '/notes/conflict':
        yield* annotations.persistNote(
          application.applicationId,
          note('crud-note-2')
        )
        return yield* annotations.findNote('crud-note-2')
      case '/fx':
        yield* fxRates.save(fxRate)
        return yield* fxRates.findLatest('USD', 'EUR')
      default:
        return { ok: true }
    }
  })

export default {
  async fetch(request: Request, env: Env) {
    const live = RegistryCrudD1Live.pipe(
      Layer.provide(registryDatabaseD1Layer(env.APPLICATION_REGISTRY_DB))
    )
    const result = await Effect.runPromiseExit(
      program(new URL(request.url).pathname).pipe(Effect.provide(live))
    )

    return result._tag === 'Success'
      ? Response.json(result.value)
      : Response.json({ error: result.cause.toString() }, { status: 500 })
  },
}
