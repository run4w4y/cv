import { ArtifactStore } from '@cv/application-registry-artifact-store'
import { Effect, Layer } from 'effect'

import { RegistryArtifactError } from '../errors'
import {
  OpaqueObjectsService,
  type OpaqueObjectsService as OpaqueObjectsServiceShape,
} from '../services/opaque-objects'

const make = Effect.gen(function* () {
  const store = yield* ArtifactStore

  const put = Effect.fn('OpaqueObjectsService.put')((bytes: Uint8Array) =>
    store.put(bytes).pipe(
      Effect.mapError(
        (cause) =>
          new RegistryArtifactError({
            cause,
            message: 'Could not store opaque registry bytes.',
            operation: 'write',
          })
      )
    )
  )

  return {
    put: (input: Uint8Array) => put(input.slice()),
    read: Effect.fn('OpaqueObjectsService.read')((sha256: string) =>
      store.read(sha256).pipe(
        Effect.map((bytes) => bytes.slice()),
        Effect.mapError(
          (cause) =>
            new RegistryArtifactError({
              cause,
              message: 'Could not read opaque registry bytes.',
              operation: 'read',
            })
        )
      )
    ),
  } satisfies OpaqueObjectsServiceShape
})

export const OpaqueObjectsServiceLive = Layer.effect(OpaqueObjectsService, make)
