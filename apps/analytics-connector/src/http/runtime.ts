import { Layer } from 'effect'
import { HttpMiddleware, HttpRouter, HttpServer } from 'effect/unstable/http'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { AnalyticsDataLayer } from '../services/analytics-data'
import { AnalyticsTablesLayer } from '../services/analytics-tables'
import { AudienceCodecLayer } from '../services/audience-codec'
import { AnalyticsConnectorApi } from './api'
import { AnalyticsHandlersLayer } from './handlers/analytics'
import { HealthHandlersLayer } from './handlers/health'
import { ConnectorAuthorizationLayer } from './middleware/auth'

const ApiHandlersLayer = Layer.provide(
  HttpApiBuilder.layer(AnalyticsConnectorApi),
  [HealthHandlersLayer, AnalyticsHandlersLayer]
)

const AnalyticsTablesWithDependenciesLayer = Layer.provide(
  AnalyticsTablesLayer,
  [AnalyticsDataLayer, AudienceCodecLayer]
)

const ApiLayer = Layer.provide(ApiHandlersLayer, [
  AnalyticsTablesWithDependenciesLayer,
  ConnectorAuthorizationLayer,
])

const HandlerLayer = Layer.provide(ApiLayer, HttpServer.layerServices)

const corsMiddleware = HttpMiddleware.cors({
  allowedHeaders: ['Authorization', 'Content-Type'],
  allowedMethods: ['GET', 'OPTIONS'],
})

export const analyticsConnectorWebHandler = HttpRouter.toWebHandler(
  HandlerLayer,
  {
    middleware: corsMiddleware,
  }
).handler
