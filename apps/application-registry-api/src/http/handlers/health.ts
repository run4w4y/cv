import { ApplicationRegistryApi } from '@cv/application-registry-api-contract'
import { Effect, Layer } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

const PublicHealthHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'public',
  (handlers) => handlers.handle('health', () => Effect.succeed({ ok: true }))
)

const RegistryHealthHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'registryHealth',
  (handlers) =>
    handlers.handle('authenticatedHealth', () => Effect.succeed({ ok: true }))
)

export const HealthHandlersLayer = Layer.merge(
  PublicHealthHandlersLayer,
  RegistryHealthHandlersLayer
)
