import { ApplicationRegistryApi } from '@cv/application-registry-api-contract'
import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/unstable/http'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

import { makeRegistryServiceLayer } from '../layers/registry'
import type { ApplicationRegistryEnv } from '../worker/types'
import { HealthHandlersLayer } from './handlers/health'
import { RegistryHandlersLayer } from './handlers/registry'
import { RegistryAuthorizationLayer } from './middleware/auth'

const ApiHandlersLayer = Layer.provide(
  HttpApiBuilder.layer(ApplicationRegistryApi, {
    openapiPath: '/openapi.json',
  }),
  [HealthHandlersLayer, RegistryHandlersLayer]
)

const handlerLayer = (environment: ApplicationRegistryEnv) => {
  const ApiLayer = Layer.provide(ApiHandlersLayer, [
    makeRegistryServiceLayer(environment),
    RegistryAuthorizationLayer,
  ])

  return Layer.provide(ApiLayer, HttpServer.layerServices)
}

type WebHandler = ReturnType<typeof HttpRouter.toWebHandler>

const handlers = new WeakMap<ApplicationRegistryEnv, WebHandler>()

export const applicationRegistryWebHandler = (
  environment: ApplicationRegistryEnv
) => {
  const cached = handlers.get(environment)
  if (cached) return cached.handler

  const handler = HttpRouter.toWebHandler(handlerLayer(environment))
  handlers.set(environment, handler)
  return handler.handler
}
