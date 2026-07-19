import { ArtifactStore } from '@cv/application-registry-artifact-store'
import { makeR2ArtifactStore } from '@cv/application-registry-artifact-store/live'
import { makeRegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  CvPublicationsServiceLive,
  PdfArtifactsServiceLive,
} from '@cv/application-registry-service/live'
import { Effect, Layer } from 'effect'

import { WorkerEnv } from '../worker/bindings'

const RegistryCrudLayer = makeRegistryCrudLive(
  WorkerEnv.pipe(
    Effect.map((environment) => environment.APPLICATION_REGISTRY_DB)
  )
)

const withArtifactStore = <A, E>(
  operation: (
    store: ReturnType<typeof makeR2ArtifactStore>
  ) => Effect.Effect<A, E>
) =>
  WorkerEnv.pipe(
    Effect.flatMap((environment) =>
      operation(makeR2ArtifactStore(environment.CV_OBJECTS))
    )
  )

const ArtifactStoreLayer = Layer.succeed(ArtifactStore, {
  head: (sha256) => withArtifactStore((store) => store.head(sha256)),
  put: (bytes) => withArtifactStore((store) => store.put(bytes)),
  read: (sha256) => withArtifactStore((store) => store.read(sha256)),
})

const PdfRegistryServicesLive = Layer.merge(
  CvPublicationsServiceLive,
  PdfArtifactsServiceLive
)

export const RegistryServiceLayer = PdfRegistryServicesLive.pipe(
  Layer.provide(ArtifactStoreLayer),
  Layer.provide(RegistryCrudLayer)
)
