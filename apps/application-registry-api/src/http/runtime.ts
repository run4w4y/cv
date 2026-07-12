import { ApplicationRegistryApi } from '@cv/application-registry-api-contract'
import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/unstable/http'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

import { RegistryServiceLayer } from '../layers/registry'
import { HealthHandlersLayer } from './handlers/health'
import { RegistryHandlersLayer } from './handlers/registry'
import { RegistryAuthorizationLayer } from './middleware/auth'

const ApiHandlersLayer = Layer.provide(
  HttpApiBuilder.layer(ApplicationRegistryApi, {
    openapiPath: '/openapi.json',
  }),
  [HealthHandlersLayer, RegistryHandlersLayer]
)

const ApiLayer = Layer.provide(ApiHandlersLayer, [
  RegistryServiceLayer,
  RegistryAuthorizationLayer,
])

const HandlerLayer = Layer.provide(ApiLayer, HttpServer.layerServices)

export const applicationRegistryWebHandler =
  HttpRouter.toWebHandler(HandlerLayer).handler
