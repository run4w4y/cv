import type { AnalyticsDashboardData } from '@cv/analytics-core'
import {
  buildGrafanaAnalyticsTables,
  type GrafanaAnalyticsTables,
} from '@cv/analytics-grafana'
import { Context, Effect, Layer } from 'effect'

import { InternalServerError } from '../http/errors'
import type { AuthenticatedConnectorRequest } from '../http/middleware/auth'
import type { AnalyticsConnectorQuery } from '../http/schemas'
import { AnalyticsData } from './analytics-data'
import { withAnalyticsTablesCache } from './analytics-tables-cache'
import { AudienceCodec } from './audience-codec'

export class AnalyticsTables extends Context.Service<
  AnalyticsTables,
  {
    readonly load: (
      query: AnalyticsConnectorQuery
    ) => Effect.Effect<
      GrafanaAnalyticsTables,
      InternalServerError,
      AuthenticatedConnectorRequest
    >
  }
>()('AnalyticsTables') {}

const buildAnalyticsTables = ({
  data,
}: {
  readonly data: AnalyticsDashboardData
}) =>
  Effect.try({
    try: () => buildGrafanaAnalyticsTables(data),
    catch: (cause) =>
      InternalServerError.fromCause({
        cause,
        message: 'Grafana analytics tables could not be built',
      }),
  })

export const AnalyticsTablesLayer = Layer.effect(
  AnalyticsTables,
  Effect.all({
    dataService: AnalyticsData,
    audienceCodec: AudienceCodec,
  }).pipe(
    Effect.map(({ audienceCodec, dataService }) => ({
      load: Effect.fn('AnalyticsTables.load')(
        (query: AnalyticsConnectorQuery) =>
          withAnalyticsTablesCache(
            query,
            dataService.load(query).pipe(
              Effect.flatMap(audienceCodec.decodeDashboardData),
              Effect.flatMap((data) => buildAnalyticsTables({ data }))
            )
          )
      ),
    }))
  )
)
