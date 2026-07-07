import type { GrafanaAnalyticsTables } from '@cv/analytics-grafana'
import { Effect, Schema } from 'effect'

import { InternalServerError } from '../http/errors'
import { AuthenticatedConnectorRequest } from '../http/middleware/auth'
import {
  type AnalyticsConnectorQuery,
  GrafanaAnalyticsTablesSchema,
} from '../http/schemas'
import { WorkerContext } from '../worker/bindings'
import { readCacheTtlSeconds, withWorkerEnvConfig } from '../worker/config'
import type { WorkerExecutionContext } from '../worker/types'

const tableCacheUrl = 'https://analytics-connector.internal/v1/tables'

const hasDefaultCache = (
  value: CacheStorage
): value is CacheStorage & { default: Cache } => 'default' in value

const cacheStorage = () => {
  const storage = globalThis.caches

  return storage && hasDefaultCache(storage) ? storage.default : undefined
}

const tableCacheKey = (query: AnalyticsConnectorQuery) => {
  const cacheUrl = new URL(tableCacheUrl)

  if (query.from) {
    cacheUrl.searchParams.set('from', query.from)
  }

  if (query.host) {
    cacheUrl.searchParams.set('host', query.host)
  }

  if (query.to) {
    cacheUrl.searchParams.set('to', query.to)
  }

  cacheUrl.searchParams.sort()

  return new Request(cacheUrl.toString(), { method: 'GET' })
}

const readCacheHit = (cache: Cache, cacheKey: Request) =>
  Effect.tryPromise({
    try: () => cache.match(cacheKey),
    catch: (cause) =>
      InternalServerError.fromCause({
        cause,
        message: 'Connector table cache could not be read',
      }),
  })

const decodeCachedTables = (response: Response) =>
  Effect.tryPromise({
    try: () => response.clone().json(),
    catch: (cause) =>
      InternalServerError.fromCause({
        cause,
        message: 'Connector table cache contained invalid analytics tables',
      }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(GrafanaAnalyticsTablesSchema)),
    Effect.mapError((cause) =>
      InternalServerError.fromCause({
        cause,
        message: 'Connector table cache contained invalid analytics tables',
      })
    )
  )

const cacheTables = (
  cache: Cache,
  cacheKey: Request,
  ttl: number,
  workerContext: WorkerExecutionContext,
  tables: GrafanaAnalyticsTables
) => {
  const response = new Response(JSON.stringify(tables), {
    headers: {
      'Cache-Control': `private, max-age=${ttl}, s-maxage=${ttl}`,
      'Content-Type': 'application/json',
    },
  })

  workerContext.waitUntil(cache.put(cacheKey, response))

  return tables
}

export const withAnalyticsTablesCache = (
  query: AnalyticsConnectorQuery,
  load: Effect.Effect<GrafanaAnalyticsTables, InternalServerError>
) =>
  AuthenticatedConnectorRequest.pipe(
    Effect.flatMap(() =>
      Effect.gen(function* () {
        const workerContext = yield* WorkerContext
        const cache = cacheStorage()
        const ttl = yield* readCacheTtlSeconds.pipe(
          withWorkerEnvConfig,
          Effect.mapError((error) =>
            InternalServerError.make({ message: error.message })
          )
        )

        if (!cache) {
          return yield* load
        }

        const cacheKey = tableCacheKey(query)
        const cachedResponse = yield* readCacheHit(cache, cacheKey)

        if (cachedResponse) {
          return yield* decodeCachedTables(cachedResponse)
        }

        const tables = yield* load

        return cacheTables(cache, cacheKey, ttl, workerContext, tables)
      })
    )
  )
