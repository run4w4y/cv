import { Context, type Effect } from 'effect'

export interface RegistryIds {
  readonly next: Effect.Effect<string>
}

export const RegistryIds = Context.Service<RegistryIds>(
  '@cv/application-registry-service/RegistryIds'
)
