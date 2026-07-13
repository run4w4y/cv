import { makeRegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  FrankfurterFxRateProviderLive,
  FxRatesLive,
} from '@cv/application-registry-fx'
import { RegistryServicesLive } from '@cv/application-registry-service/live'
import { ListingAvailabilityCheckerLive } from '@cv/application-registry-listing-check'
import { Effect, Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { WorkerEnv } from '../worker/bindings'

const RegistryCrudLayer = makeRegistryCrudLive(
  WorkerEnv.pipe(Effect.map((env) => env.APPLICATION_REGISTRY_DB))
)

const FxRateProviderLayer = FrankfurterFxRateProviderLive.pipe(
  Layer.provide(FetchHttpClient.layer)
)

const FxLayer = FxRatesLive.pipe(
  Layer.provide(RegistryCrudLayer),
  Layer.provide(FxRateProviderLayer)
)

export const RegistryServiceLayer = RegistryServicesLive.pipe(
  Layer.provide(RegistryCrudLayer),
  Layer.provide(FxLayer),
  Layer.provide(ListingAvailabilityCheckerLive)
)
