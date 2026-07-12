import { ApplicationRegistryApi } from '@cv/application-registry-api-contract'
import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

export const HealthHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'public',
  (handlers) => handlers.handle('health', () => Effect.succeed({ ok: true }))
)
