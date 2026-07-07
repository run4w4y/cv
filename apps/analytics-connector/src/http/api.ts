import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi'
import { BadRequestErrorSchema, InternalServerErrorSchema } from './errors'
import { ConnectorAuthorization } from './middleware/auth'
import {
  AnalyticsConnectorQuerySchema,
  GrafanaTableSchemas,
  HealthResponseSchema,
  VariableRowsSchema,
} from './schemas'

const analyticsEndpointErrors = [
  BadRequestErrorSchema,
  InternalServerErrorSchema,
] as const

export class PublicApi extends HttpApiGroup.make('public', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('health', '/health', {
    success: HealthResponseSchema,
  })
) {}

export class AnalyticsApi extends HttpApiGroup.make('analytics')
  .add(
    HttpApiEndpoint.get('summary', '/summary', {
      error: analyticsEndpointErrors,
      query: AnalyticsConnectorQuerySchema,
      success: GrafanaTableSchemas.summary,
    })
  )
  .add(
    HttpApiEndpoint.get('audiences', '/audiences', {
      error: analyticsEndpointErrors,
      query: AnalyticsConnectorQuerySchema,
      success: GrafanaTableSchemas.audiences,
    })
  )
  .add(
    HttpApiEndpoint.get('audienceDaily', '/audience-daily', {
      error: analyticsEndpointErrors,
      query: AnalyticsConnectorQuerySchema,
      success: GrafanaTableSchemas.audienceDaily,
    })
  )
  .add(
    HttpApiEndpoint.get('audienceDimensions', '/audience-dimensions', {
      error: analyticsEndpointErrors,
      query: AnalyticsConnectorQuerySchema,
      success: GrafanaTableSchemas.audienceDimensions,
    })
  )
  .add(
    HttpApiEndpoint.get('paths', '/paths', {
      error: analyticsEndpointErrors,
      query: AnalyticsConnectorQuerySchema,
      success: GrafanaTableSchemas.paths,
    })
  )
  .add(
    HttpApiEndpoint.get('variableCompanies', '/variables/companies', {
      error: analyticsEndpointErrors,
      query: AnalyticsConnectorQuerySchema,
      success: VariableRowsSchema,
    })
  )
  .add(
    HttpApiEndpoint.get('variableLocales', '/variables/locales', {
      error: analyticsEndpointErrors,
      query: AnalyticsConnectorQuerySchema,
      success: VariableRowsSchema,
    })
  )
  .add(
    HttpApiEndpoint.get('variableStages', '/variables/stages', {
      error: analyticsEndpointErrors,
      query: AnalyticsConnectorQuerySchema,
      success: VariableRowsSchema,
    })
  )
  .prefix('/v1')
  .middleware(ConnectorAuthorization) {}

export class AnalyticsConnectorApi extends HttpApi.make('analyticsConnector')
  .add(PublicApi)
  .add(AnalyticsApi) {}

export const analyticsConnectorPaths = [
  '/health',
  '/v1/audience-daily',
  '/v1/audience-dimensions',
  '/v1/audiences',
  '/v1/paths',
  '/v1/summary',
  '/v1/variables/companies',
  '/v1/variables/locales',
  '/v1/variables/stages',
] as const

export const knownConnectorPaths = new Set<string>(analyticsConnectorPaths)
