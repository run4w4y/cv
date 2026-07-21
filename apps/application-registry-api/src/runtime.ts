import type { S3Client } from '@aws-sdk/client-s3'
import { ApplicationRegistryApi } from '@cv/application-registry-api-contract'
import { makeS3ArtifactStoreLayer } from '@cv/application-registry-artifact-store/live'
import { RegistryCrudLive } from '@cv/application-registry-crud/live'
import { RegistryAnalyticsError } from '@cv/application-registry-service'
import { RegistryServicesLive } from '@cv/application-registry-service/live'
import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { BunServices } from '@effect/platform-bun'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/unstable/http'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

import { CloudflareCvAnalyticsTrafficLive } from './analytics/cloudflare'
import { makeCvCacheInvalidatorLayer } from './cache-invalidation'
import type { ApiServerConfiguration } from './config'
import { factsRegistryLayer } from './facts/registry'
import { FactsPublicationHandlersLayer } from './http/handlers/facts'
import { HealthHandlersLayer } from './http/handlers/health'
import { RegistryHandlersLayers } from './http/handlers/registry'
import {
  makeFactsPublisherAuthorizationLayer,
  makeRegistryAuthorizationLayer,
} from './http/middleware/auth'
import { CvPublicResolverRoutesLayer } from './internal/cv-public-resolver'
import { makeS3FactsStorageLayer } from './s3-facts-storage'

const ApiHandlersLayer = Layer.provide(
  HttpApiBuilder.layer(ApplicationRegistryApi, {
    openapiPath: '/openapi.json',
  }),
  [
    HealthHandlersLayer,
    FactsPublicationHandlersLayer,
    CvPublicResolverRoutesLayer,
    ...RegistryHandlersLayers,
  ]
)

const makeCloudflareClientLayer = (configuration: ApiServerConfiguration) =>
  CloudflareAnalytics.layer.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(
          CloudflareAnalytics.Configuration,
          CloudflareAnalytics.Configuration.of({
            apiToken: configuration.analytics.apiToken,
            endpoint: configuration.analytics.endpoint,
            host: configuration.analytics.host,
            zoneId: configuration.analytics.zoneId,
          })
        ),
        FetchHttpClient.layer
      )
    ),
    Layer.catch((cause) =>
      Layer.effect(
        CloudflareAnalytics.Service,
        Effect.fail(
          new RegistryAnalyticsError({
            cause,
            message: 'Cloudflare analytics configuration is invalid.',
          })
        )
      )
    )
  )

export const makeRegistryServicesLayer = (
  configuration: ApiServerConfiguration,
  s3: S3Client
) => {
  const postgres = PgClient.layer({
    applicationName: 'application-registry-api',
    connectTimeout: '10 seconds',
    database: configuration.postgres.database,
    host: configuration.postgres.host,
    maxConnections: configuration.postgres.maxConnections,
    password: configuration.postgres.password,
    port: configuration.postgres.port,
    username: configuration.postgres.username,
  })
  const crud = RegistryCrudLive.pipe(Layer.provide(postgres))
  const artifacts = makeS3ArtifactStoreLayer(
    s3,
    configuration.minio.objectsBucket
  )
  const analytics = CloudflareCvAnalyticsTrafficLive.pipe(
    Layer.provide(makeCloudflareClientLayer(configuration))
  )

  return Layer.merge(
    RegistryServicesLive.pipe(
      Layer.provide(analytics),
      Layer.provide(artifacts),
      Layer.provide(crud)
    ),
    factsRegistryLayer(
      makeS3FactsStorageLayer(s3, configuration.minio.factsBucket)
    ).pipe(Layer.provide(BunServices.layer))
  )
}

export const makeApiWebHandler = (
  configuration: ApiServerConfiguration,
  s3: S3Client
) => {
  const cacheInvalidation =
    configuration.cacheInvalidation.url === undefined ||
    configuration.cacheInvalidation.secret === undefined
      ? undefined
      : {
          origin: configuration.cacheInvalidation.url,
          secret: configuration.cacheInvalidation.secret,
        }
  const api = Layer.provide(ApiHandlersLayer, [
    makeRegistryServicesLayer(configuration, s3),
    makeCvCacheInvalidatorLayer(cacheInvalidation),
    makeFactsPublisherAuthorizationLayer(
      configuration.authentication.factsPublishToken
    ),
    makeRegistryAuthorizationLayer(
      configuration.authentication.registryApiToken
    ),
  ])

  return HttpRouter.toWebHandler(Layer.provide(api, HttpServer.layerServices))
}
