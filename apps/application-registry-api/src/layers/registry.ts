import { ArtifactStore } from '@cv/application-registry-artifact-store'
import { makeR2ArtifactStore } from '@cv/application-registry-artifact-store/live'
import { makeRegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  FrankfurterFxRateProviderLive,
  FxRatesLive,
} from '@cv/application-registry-fx'
import { ListingAvailabilityCheckerLive } from '@cv/application-registry-listing-check'
import { RegistryServicesLive } from '@cv/application-registry-service/live'
import { Effect, Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { WorkerEnv } from '../worker/bindings'

const RegistryCrudLayer = makeRegistryCrudLive(
  WorkerEnv.pipe(Effect.map((env) => env.APPLICATION_REGISTRY_DB))
)

const withArtifactStore = <A, E>(
  operation: (
    store: ReturnType<typeof makeR2ArtifactStore>
  ) => Effect.Effect<A, E>
) =>
  WorkerEnv.pipe(
    Effect.flatMap((env) => operation(makeR2ArtifactStore(env.CV_OBJECTS)))
  )

const ArtifactStoreLayer = Layer.succeed(ArtifactStore, {
  head: (sha256) => withArtifactStore((store) => store.head(sha256)),
  put: (bytes) => withArtifactStore((store) => store.put(bytes)),
  read: (sha256) => withArtifactStore((store) => store.read(sha256)),
})

const FxRateProviderLayer = FrankfurterFxRateProviderLive.pipe(
  Layer.provide(FetchHttpClient.layer)
)

const FxLayer = FxRatesLive.pipe(
  Layer.provide(RegistryCrudLayer),
  Layer.provide(FxRateProviderLayer)
)

export const RegistryServiceLayer = RegistryServicesLive.pipe(
  Layer.provide(ArtifactStoreLayer),
  Layer.provide(RegistryCrudLayer),
  Layer.provide(FxLayer),
  Layer.provide(ListingAvailabilityCheckerLive)
)
