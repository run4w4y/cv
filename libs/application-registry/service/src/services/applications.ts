import type {
  Application,
  ApplicationLabel,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  ListApplicationsInput,
  PatchApplicationInput,
  RegistryPage,
  UpsertApplicationInput,
} from '../types'

export interface ApplicationsService {
  readonly find: (
    identifier: string
  ) => Effect.Effect<Application, ApplicationRegistryError>
  readonly list: (
    input: ListApplicationsInput
  ) => Effect.Effect<RegistryPage<Application>, ApplicationRegistryError>
  readonly patch: (
    identifier: string,
    input: PatchApplicationInput
  ) => Effect.Effect<Application, ApplicationRegistryError>
  readonly remove: (
    identifier: string
  ) => Effect.Effect<void, ApplicationRegistryError>
  readonly replaceLabels: (
    identifier: string,
    labels: readonly string[]
  ) => Effect.Effect<readonly ApplicationLabel[], ApplicationRegistryError>
  readonly upsert: (
    input: UpsertApplicationInput
  ) => Effect.Effect<Application, ApplicationRegistryError>
}

export const ApplicationsService = Context.Service<ApplicationsService>(
  '@cv/application-registry-service/ApplicationsService'
)
