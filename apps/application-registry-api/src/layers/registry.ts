import {
  RegistryCrudD1Live,
  RegistryDatabase,
  registryDatabaseD1Layer,
} from '@cv/application-registry-crud/d1'
import {
  FrankfurterFxRateProviderLive,
  FxRatesLive,
} from '@cv/application-registry-fx'
import {
  RegistryIdsLive,
  RegistryServicesLive,
} from '@cv/application-registry-service/live'
import { Effect, Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { WorkerEnv } from '../worker/bindings'

const RegistryDatabaseLayer = Layer.succeed(
  RegistryDatabase,
  RegistryDatabase.of({
    use: (operation) =>
      WorkerEnv.pipe(
        Effect.flatMap((env) =>
          RegistryDatabase.use((database) => database.use(operation)).pipe(
            Effect.provide(registryDatabaseD1Layer(env.APPLICATION_REGISTRY_DB))
          )
        )
      ),
  })
)

const RegistryCrudLayer = RegistryCrudD1Live.pipe(
  Layer.provide(RegistryDatabaseLayer)
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
  Layer.provide(RegistryIdsLive),
  Layer.provide(FxLayer)
)
