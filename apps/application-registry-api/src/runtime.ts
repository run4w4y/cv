import type { S3Client } from '@aws-sdk/client-s3'
import { ApplicationRegistryApi } from '@cv/application-registry-api-contract'
import { makeS3ArtifactStoreLayer } from '@cv/application-registry-artifact-store/live'
import { RegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  makeNatsRegistryEventPublisherLayer,
  makeRegistryEventPublisherConfiguration,
} from '@cv/application-registry-events-nats'
import {
  CvPublicationConfiguration,
  RegistryAnalyticsError,
} from '@cv/application-registry-service'
import { RegistryServicesLive } from '@cv/application-registry-service/live'
import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { BunServices } from '@effect/platform-bun'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, Redacted } from 'effect'
import { HttpRouter, HttpServer } from 'effect/unstable/http'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

import { CloudflareCvAnalyticsTrafficLive } from './analytics/cloudflare'
import type { ApiServerConfiguration } from './config'
import { factsRegistryLayer } from './facts/registry'
import { FactsPublicationHandlersLayer } from './http/handlers/facts'
import { HealthHandlersLayer } from './http/handlers/health'
import { RegistryHandlersLayers } from './http/handlers/registry'
import {
  makeFactsPublisherAuthorizationLayer,
  makeRegistryAuthorizationLayer,
} from './http/middleware/auth'
import { makeFactsObjectRoutesLayer } from './http/routes/facts-objects'
import { CvPublicResolverRoutesLayer } from './internal/cv-public-resolver'
import { makeS3FactsStorage, makeS3FactsStorageLayer } from './s3-facts-storage'

const makeApiHandlersLayer = (
  configuration: ApiServerConfiguration,
  s3: S3Client
) =>
  Layer.provide(
    HttpApiBuilder.layer(ApplicationRegistryApi, {
      openapiPath: '/openapi.json',
    }),
    [
      HealthHandlersLayer,
      FactsPublicationHandlersLayer,
      makeFactsObjectRoutesLayer(
        makeS3FactsStorage(s3, configuration.minio.factsBucket),
        configuration.authentication.registryApiToken
      ),
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
  const events = makeNatsRegistryEventPublisherLayer(
    makeRegistryEventPublisherConfiguration({
      nats: {
        clientName: 'application-registry-api',
        maxReconnectAttempts: -1,
        password: Redacted.value(configuration.nats.password),
        server: configuration.nats.server,
        username: configuration.nats.username,
      },
    })
  )
  const publication = Layer.succeed(
    CvPublicationConfiguration,
    CvPublicationConfiguration.of({
      publicBaseUrl: configuration.publication.publicBaseUrl,
    })
  )

  return Layer.merge(
    RegistryServicesLive.pipe(
      Layer.provide(analytics),
      Layer.provide(artifacts),
      Layer.provide(crud),
      Layer.provide(events),
      Layer.provide(publication)
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
  const api = Layer.provide(makeApiHandlersLayer(configuration, s3), [
    makeRegistryServicesLayer(configuration, s3),
    makeFactsPublisherAuthorizationLayer(
      configuration.authentication.factsPublishToken
    ),
    makeRegistryAuthorizationLayer(
      configuration.authentication.registryApiToken
    ),
  ])
  const app = Layer.merge(
    api,
    HttpRouter.cors({
      allowedHeaders: ['authorization', 'content-type', 'idempotency-key'],
      allowedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedOrigins: configuration.cors.allowedOrigins,
      maxAge: 86_400,
    })
  )

  return HttpRouter.toWebHandler(Layer.provide(app, HttpServer.layerServices))
}
