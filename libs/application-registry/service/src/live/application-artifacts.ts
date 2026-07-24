import { ArtifactStore } from '@cv/application-registry-artifact-store'
import {
  ApplicationArtifactsCrud,
  ApplicationsCrud,
  IdempotencyCrud,
} from '@cv/application-registry-crud'
import type { ApplicationArtifact } from '@cv/application-registry-entity'
import { Effect, Layer, Option } from 'effect'

import {
  RegistryArtifactError,
  RegistryBadRequestError,
  RegistryDatabaseError,
  RegistryNotFoundError,
} from '../errors'
import { operationRequestSignature } from '../internal/operation-request-signature'
import {
  findRequiredApplication,
  findValidatedIdempotency,
  type IdempotencyIdentity,
  missingRegistryData,
  newRegistryId,
  recoverConcurrentReplay,
  registryNow,
  requireReceiptResourceId,
} from '../internal/shared'
import {
  ApplicationArtifactsService,
  type ApplicationArtifactsService as ApplicationArtifactsServiceShape,
} from '../services/application-artifacts'
import type { CreateApplicationArtifactInput } from '../types'

const requireArtifact = (
  artifact: ApplicationArtifact | undefined,
  artifactId: string
) =>
  artifact
    ? Effect.succeed(artifact)
    : Effect.fail(
        new RegistryDatabaseError({
          cause: new Error('An operation receipt has no application artifact.'),
          message: `Application artifact is missing: ${artifactId}`,
        })
      )

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const artifacts = yield* ApplicationArtifactsCrud
  const idempotency = yield* IdempotencyCrud
  const store = yield* ArtifactStore

  const findAssociated = Effect.fn(
    'ApplicationArtifactsService.findAssociated'
  )((applicationIdentifier: string, artifactId: string) =>
    Effect.gen(function* () {
      const application = yield* findRequiredApplication(
        applications,
        applicationIdentifier
      )
      const artifact = yield* artifacts.find(artifactId)
      if (!artifact || artifact.applicationId !== application.id) {
        return yield* new RegistryNotFoundError({
          identifier: artifactId,
          message: `Application artifact not found: ${artifactId}`,
        })
      }
      return artifact
    })
  )

  return {
    create: Effect.fn('ApplicationArtifactsService.create')(
      (
        applicationIdentifier: string,
        request: CreateApplicationArtifactInput
      ) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            applicationIdentifier
          )
          const filename = request.filename.trim()
          const mediaType = request.mediaType.trim()
          const operationId = request.operationId.trim()
          if (
            filename.length === 0 ||
            mediaType.length === 0 ||
            operationId.length === 0
          ) {
            return yield* new RegistryBadRequestError({
              message:
                'Artifact filename, media type, and operation ID must not be empty.',
            })
          }

          const identity: IdempotencyIdentity = {
            applicationId: application.id,
            scope: 'application_artifact',
            idempotencyKey: operationId,
            requestHash: operationRequestSignature('application_artifact', {
              applicationId: application.id,
              category: request.category,
              filename,
              locale: request.locale,
              mediaType,
              sha256: request.sha256,
            }),
          }
          const replay = yield* findValidatedIdempotency(idempotency, identity)
          if (replay) {
            const artifactId = yield* requireReceiptResourceId(replay)
            const artifact = yield* artifacts
              .find(artifactId)
              .pipe(
                Effect.flatMap((value) => requireArtifact(value, artifactId))
              )
            return { artifact, replayed: true }
          }

          const metadata = yield* store.head(request.sha256).pipe(
            Effect.mapError(
              (cause) =>
                new RegistryArtifactError({
                  cause,
                  message: 'Could not verify the uploaded artifact.',
                  operation: 'verify',
                })
            )
          )
          if (Option.isNone(metadata)) {
            return yield* new RegistryBadRequestError({
              message:
                'The uploaded artifact blob does not exist in registry storage.',
            })
          }

          const artifact: ApplicationArtifact = {
            applicationId: application.id,
            byteLength: metadata.value.byteLength,
            category: request.category,
            contentRevisionId: null,
            createdAt: yield* registryNow,
            filename,
            generatedArtifactId: null,
            id: newRegistryId(),
            locale: request.locale ?? null,
            mediaType,
            objectKey: metadata.value.key,
            sha256: metadata.value.sha256,
            source: 'uploaded',
          }
          const replayed = yield* recoverConcurrentReplay(
            idempotency,
            identity,
            artifacts.persistUploaded(application.id, {
              artifact,
              idempotencyKey: identity.idempotencyKey,
              requestHash: identity.requestHash,
            })
          )
          const storedArtifactId = replayed
            ? yield* findValidatedIdempotency(idempotency, identity).pipe(
                Effect.flatMap((receipt) =>
                  receipt
                    ? requireReceiptResourceId(receipt)
                    : Effect.fail(
                        missingRegistryData(
                          'Concurrent application artifact receipt disappeared.'
                        )
                      )
                )
              )
            : artifact.id
          const stored = yield* artifacts
            .find(storedArtifactId)
            .pipe(
              Effect.flatMap((value) =>
                requireArtifact(value, storedArtifactId)
              )
            )
          return { artifact: stored, replayed }
        })
    ),
    find: findAssociated,
    list: Effect.fn('ApplicationArtifactsService.list')(
      (applicationIdentifier: string) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            applicationIdentifier
          )
          return yield* artifacts.listByApplication(application.id)
        })
    ),
    read: Effect.fn('ApplicationArtifactsService.read')(
      (applicationIdentifier: string, artifactId: string) =>
        Effect.gen(function* () {
          const artifact = yield* findAssociated(
            applicationIdentifier,
            artifactId
          )
          const bytes = yield* store.read(artifact.sha256).pipe(
            Effect.mapError(
              (cause) =>
                new RegistryArtifactError({
                  cause,
                  message: 'Could not read the application artifact.',
                  operation: 'read',
                })
            )
          )
          return { artifact, bytes }
        })
    ),
  } satisfies ApplicationArtifactsServiceShape
})

export const ApplicationArtifactsServiceLive = Layer.effect(
  ApplicationArtifactsService,
  make
)
