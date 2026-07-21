import type { S3Client } from '@aws-sdk/client-s3'
import { makeS3ArtifactStoreLayer } from '@cv/application-registry-artifact-store/live'
import { RegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  mapPdfPersistenceError,
  PdfArtifactPersistence,
} from '@cv/application-registry-pdf-processing'
import { PdfArtifactsService } from '@cv/application-registry-service'
import { PdfArtifactsServiceLive } from '@cv/application-registry-service/live'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer } from 'effect'
import type { PdfRunnerConfiguration } from './config'

export const makePdfArtifactPersistenceLayer = (
  configuration: PdfRunnerConfiguration,
  s3: S3Client
) => {
  const postgres = PgClient.layer({
    applicationName: 'cv-pdf-runner',
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
  const artifactsLayer = PdfArtifactsServiceLive.pipe(
    Layer.provide(Layer.merge(crud, store))
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
        fail: (applicationId, artifactId, errorCode, errorMessage) =>
          artifacts
            .fail(applicationId, artifactId, errorCode, errorMessage)
            .pipe(Effect.mapError(mapPdfPersistenceError('fail'))),
        load: (request) =>
          artifacts
            .findJob(request.applicationId, request.entryId, request.artifactId)
            .pipe(Effect.mapError(mapPdfPersistenceError('load'))),
      })
    })
  ).pipe(Layer.provide(artifactsLayer))
}
