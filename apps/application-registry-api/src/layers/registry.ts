import { ArtifactStore } from '@cv/application-registry-artifact-store'
import { makeR2ArtifactStore } from '@cv/application-registry-artifact-store/live'
import { makeRegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  FrankfurterFxRateProviderLive,
  FxRatesLive,
} from '@cv/application-registry-fx'
import { ListingAvailabilityCheckerLive } from '@cv/application-registry-listing-check'
import { RegistryAnalyticsError } from '@cv/application-registry-service'
import { RegistryServicesLive } from '@cv/application-registry-service/live'
import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { WebCryptoLayer } from '@cv/effect-web-crypto'
import { Effect, Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { CloudflareCvAnalyticsTrafficLive } from '../analytics/cloudflare'
import { WorkerEnv } from '../worker/bindings'
import {
  CloudflareConfigLive,
  workerConfigurationProviderLayer,
} from '../worker/config'
import type { ApplicationRegistryEnv } from '../worker/types'

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

const CloudflareClientLayer = (environment: ApplicationRegistryEnv) =>
  CloudflareAnalytics.layer.pipe(
    Layer.provide(
      Layer.merge(
        CloudflareConfigLive.pipe(
          Layer.provide(workerConfigurationProviderLayer(environment))
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

export const makeRegistryServiceLayer = (environment: ApplicationRegistryEnv) =>
  RegistryServicesLive.pipe(
    Layer.provide(
      CloudflareCvAnalyticsTrafficLive.pipe(
        Layer.provide(CloudflareClientLayer(environment))
      )
    ),
    Layer.provide(ArtifactStoreLayer),
    Layer.provide(RegistryCrudLayer),
    Layer.provide(FxLayer),
    Layer.provide(
      ListingAvailabilityCheckerLive.pipe(Layer.provide(WebCryptoLayer))
    )
  )
