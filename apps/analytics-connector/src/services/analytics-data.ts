import {
  type AnalyticsDashboardData,
  createEmptyAnalyticsDashboardData,
  sampleAnalyticsDashboardData,
} from '@cv/analytics-core'
import {
  type CloudflareAnalyticsConfig,
  type CloudflareAnalyticsRange,
  createCloudflareAnalyticsRange,
  describeCloudflareAnalyticsError,
  fetchCloudflareAnalyticsDashboardData,
} from '@cv/cloudflare-analytics-client'
import { Context, Effect, Layer } from 'effect'

import { InternalServerError } from '../http/errors'
import type { AnalyticsConnectorQuery } from '../http/schemas'
import {
  type AnalyticsFallback,
  readAnalyticsConnectorConfig,
  withWorkerEnvConfig,
} from '../worker/config'

export class AnalyticsData extends Context.Service<
  AnalyticsData,
  {
    readonly load: (
      query: AnalyticsConnectorQuery
    ) => Effect.Effect<AnalyticsDashboardData, InternalServerError>
  }
>()('AnalyticsData') {}

const loadConfiguredCloudflareData = (
  config: CloudflareAnalyticsConfig,
  range: CloudflareAnalyticsRange
) =>
  fetchCloudflareAnalyticsDashboardData({
    config,
    fetch,
    range,
  }).pipe(
    Effect.mapError((error) =>
      InternalServerError.make({
        message: describeCloudflareAnalyticsError(error),
      })
    )
  )

const loadFallbackAnalyticsData = (
  fallback: AnalyticsFallback | undefined
): Effect.Effect<AnalyticsDashboardData, InternalServerError> => {
  if (fallback === 'sample') {
    return Effect.succeed(sampleAnalyticsDashboardData())
  }

  if (fallback === 'empty') {
    return Effect.succeed(createEmptyAnalyticsDashboardData())
  }

  return Effect.fail(
    InternalServerError.make({
      message: 'Cloudflare analytics environment is not configured.',
    })
  )
}

const loadAnalyticsDashboardData = Effect.fn('AnalyticsData.load')(
  (query: AnalyticsConnectorQuery) =>
    readAnalyticsConnectorConfig.pipe(
      withWorkerEnvConfig,
      Effect.mapError((error) =>
        InternalServerError.make({ message: error.message })
      ),
      Effect.flatMap(({ cloudflare, fallback }) => {
        const range = createCloudflareAnalyticsRange({
          from: query.from,
          host: query.host ?? cloudflare?.host,
          to: query.to,
        })

        return cloudflare
          ? loadConfiguredCloudflareData(cloudflare, range)
          : loadFallbackAnalyticsData(fallback)
      })
    )
)

export const AnalyticsDataLayer = Layer.succeed(AnalyticsData, {
  load: loadAnalyticsDashboardData,
})
