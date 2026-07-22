import type { S3Client } from '@aws-sdk/client-s3'
import { makeS3ArtifactStoreLayer } from '@cv/application-registry-artifact-store/live'
import { RegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  makeNatsRegistryEventPublisherLayer,
  makeRegistryEventPublisherConfiguration,
} from '@cv/application-registry-events-nats'
import {
  mapPdfPersistenceError,
  PdfArtifactPersistence,
} from '@cv/application-registry-pdf-processing'
import { PdfArtifactsService } from '@cv/application-registry-service'
import { PdfArtifactsServiceLive } from '@cv/application-registry-service/live'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, Redacted } from 'effect'

import type { PdfWorkerConfiguration } from './config'

export const makePdfArtifactPersistenceLayer = (
  configuration: PdfWorkerConfiguration,
  s3: S3Client
) => {
  const postgres = PgClient.layer({
    applicationName: 'application-registry-pdf-worker',
    connectTimeout: '10 seconds',
    database: configuration.postgres.database,
    host: configuration.postgres.host,
    maxConnections: configuration.postgres.maxConnections,
    password: configuration.postgres.password,
    port: configuration.postgres.port,
    username: configuration.postgres.username,
  })
  const crud = RegistryCrudLive.pipe(Layer.provide(postgres))
  const store = makeS3ArtifactStoreLayer(s3, configuration.minio.objectsBucket)
  const events = makeNatsRegistryEventPublisherLayer(
    makeRegistryEventPublisherConfiguration({
      nats: {
        clientName: 'application-registry-pdf-worker-publisher',
        maxReconnectAttempts: -1,
        password: Redacted.value(configuration.nats.password),
        server: configuration.nats.server,
        username: configuration.nats.username,
      },
    })
  )
  const artifactsLayer = PdfArtifactsServiceLive.pipe(
    Layer.provide(Layer.mergeAll(crud, events, store))
  )

  return Layer.effect(
    PdfArtifactPersistence,
    Effect.gen(function* () {
      const artifacts = yield* PdfArtifactsService

      return PdfArtifactPersistence.of({
        complete: (applicationId, artifactId, rendererVersion, bytes) =>
          artifacts
            .complete(applicationId, artifactId, rendererVersion, bytes)
            .pipe(Effect.mapError(mapPdfPersistenceError('complete'))),
        ensure: (event) =>
          artifacts.ensureAttempt(event).pipe(
            Effect.flatMap((artifact) =>
              artifacts.findAttempt(
                event.applicationId,
                event.contentEntryId,
                artifact.id
              )
            ),
            Effect.mapError(mapPdfPersistenceError('ensure'))
          ),
        fail: (applicationId, artifactId, errorCode, errorMessage) =>
          artifacts
            .fail(applicationId, artifactId, errorCode, errorMessage)
            .pipe(Effect.mapError(mapPdfPersistenceError('fail'))),
      })
    })
  ).pipe(Layer.provide(artifactsLayer))
}
