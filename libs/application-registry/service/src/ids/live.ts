import { Effect, Layer } from 'effect'

import { RegistryIds } from './service'

export const RegistryIdsLive = Layer.succeed(RegistryIds, {
  next: Effect.sync(() => globalThis.crypto.randomUUID()),
})
