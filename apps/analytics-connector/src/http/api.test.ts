import { describe, expect, test } from 'bun:test'
import type { GrafanaAnalyticsTables } from '@cv/analytics-grafana'
import { Effect, Layer } from 'effect'
import { HttpClientRequest, HttpServer } from 'effect/unstable/http'
import { HttpApiMiddleware, HttpApiTest } from 'effect/unstable/httpapi'
import { AnalyticsTables } from '../services/analytics-tables'
import { makeWorkerRequestContext } from '../worker/bindings'
import type {
  AnalyticsConnectorEnv,
  WorkerExecutionContext,
} from '../worker/types'
import { AnalyticsConnectorApi } from './api'
import { AnalyticsHandlersLayer } from './handlers/analytics'
import { HealthHandlersLayer } from './handlers/health'
import {
  type AuthenticatedConnectorPrincipal,
  AuthenticatedConnectorRequest,
  ConnectorAuthorization,
  ConnectorAuthorizationLayer,
} from './middleware/auth'
import type { AnalyticsConnectorQuery } from './schemas'

const context: WorkerExecutionContext = {
  waitUntil: () => undefined,
}

const env = {
  GRAFANA_CONNECTOR_TOKEN: 'test-token',
} satisfies AnalyticsConnectorEnv

const tables = {
  audienceDaily: [],
  audienceDimensions: [],
  audiences: [
    {
      archived: false,
      audience_id: 'effect',
      company: 'Effect target',
      created_at: '',
      first_seen: '',
      label: '',
      last_seen: '',
      locale: 'en',
      page_views: 9,
      path: '/en/a/effect/',
      pdf_exported_at: '',
      profile_id: 'p_effect',
      qr_verified_at: '',
      role: 'Staff Engineer',
      stacks: 'Effect, Cloudflare',
      stage: 'active',
      variant: '',
      visitors: 3,
      visits: 4,
    },
    {
      archived: false,
      audience_id: 'shared',
      company: 'Shared target',
      created_at: '',
      first_seen: '',
      label: '',
      last_seen: '',
      locale: 'en',
      page_views: 4,
      path: '/en/a/shared/',
      pdf_exported_at: '',
      profile_id: 'p_shared',
      qr_verified_at: '',
      role: 'Staff Engineer',
      stacks: 'Effect',
      stage: 'shared',
      variant: '',
      visitors: 2,
      visits: 2,
    },
  ],
  paths: [],
  summary: [
    {
      active_audiences: 2,
      audience_views: 13,
      generated_at: '2026-06-23T00:00:00.000Z',
      public_views: 0,
      range_from: '2026-06-22T00:00:00.000Z',
      range_to: '2026-06-23T00:00:00.000Z',
      zero_visit_audiences: 0,
    },
  ],
} satisfies GrafanaAnalyticsTables

const ConnectorAuthorizationClientLayer = HttpApiMiddleware.layerClient(
  ConnectorAuthorization,
  ({ next, request }) =>
    next(HttpClientRequest.bearerToken(request, env.GRAFANA_CONNECTOR_TOKEN))
)

const makeAnalyticsTablesLayer = (
  load: (
    query: AnalyticsConnectorQuery
  ) => Effect.Effect<
    GrafanaAnalyticsTables,
    never,
    AuthenticatedConnectorRequest
  >
) =>
  Layer.succeed(AnalyticsTables, {
    load,
  })

const makeApiTestLayer = (
  analyticsTablesLayer = makeAnalyticsTablesLayer(() => Effect.succeed(tables))
) =>
  Layer.mergeAll(
    Layer.provide(
      Layer.merge(HealthHandlersLayer, AnalyticsHandlersLayer),
      analyticsTablesLayer
    ),
    HttpServer.layerServices,
    Layer.succeedContext(makeWorkerRequestContext(env, context))
  )

const provideApiTestLayer = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  analyticsTablesLayer = makeAnalyticsTablesLayer(() => Effect.succeed(tables)),
  options: { readonly authenticated?: boolean } = {}
) => {
  const provided = effect.pipe(
    Effect.provide(makeApiTestLayer(analyticsTablesLayer)),
    Effect.provide(ConnectorAuthorizationLayer)
  )

  return options.authenticated
    ? provided.pipe(Effect.provide(ConnectorAuthorizationClientLayer))
    : provided
}

const runApiTest = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.scoped(effect))

describe('analytics connector HttpApi contract', () => {
  test('serves the typed public health endpoint', async () => {
    const response = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(AnalyticsConnectorApi, [
          'public',
        ])

        return yield* client.health()
      }).pipe(provideApiTestLayer)
    )

    expect(response).toEqual({ ok: true })
  })

  test('serves typed authenticated audience rows and encodes query params', async () => {
    let observedQuery: AnalyticsConnectorQuery | undefined
    let observedPrincipal: AuthenticatedConnectorPrincipal | undefined
    const analyticsTablesLayer = makeAnalyticsTablesLayer((query) =>
      AuthenticatedConnectorRequest.pipe(
        Effect.map((principal) => {
          observedQuery = query
          observedPrincipal = principal

          return tables
        })
      )
    )

    const rows = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(AnalyticsConnectorApi, [
          'analytics',
        ])

        return yield* client.analytics.audiences({
          query: {
            from: '2026-01-01',
            host: 'cv.example.test',
            to: '2026-01-02',
          },
        })
      }).pipe((effect) =>
        provideApiTestLayer(effect, analyticsTablesLayer, {
          authenticated: true,
        })
      )
    )

    expect(rows).toEqual(tables.audiences)
    expect(observedPrincipal).toEqual({ principal: 'grafana' })
    expect(observedQuery).toEqual({
      from: '2026-01-01',
      host: 'cv.example.test',
      to: '2026-01-02',
    })
  })

  test('fails typed analytics calls before the bearer middleware authenticates', async () => {
    const exit = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(AnalyticsConnectorApi, [
          'analytics',
        ])

        return yield* Effect.exit(
          client.analytics.audiences({
            query: {},
          })
        )
      }).pipe(provideApiTestLayer)
    )

    expect(exit._tag).toBe('Failure')
    expect(exit.toString()).toContain('UnauthorizedError')
  })

  test('projects typed variable rows from authenticated tables', async () => {
    const rows = await runApiTest(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(AnalyticsConnectorApi, [
          'analytics',
        ])

        return yield* client.analytics.variableStages({
          query: {},
        })
      }).pipe((effect) =>
        provideApiTestLayer(effect, undefined, { authenticated: true })
      )
    )

    expect(rows).toEqual([
      { label: 'active', value: 'active' },
      { label: 'shared', value: 'shared' },
    ])
  })
})
