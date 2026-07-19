import type { Application } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  ApplicationFacets,
  ApplicationListPage,
  ListApplicationsInput,
  CreateApplicationInput,
  UpdateApplicationInput,
  UpdateApplicationResult,
} from '../types'

export interface ApplicationsService {
  readonly create: (
    input: CreateApplicationInput
  ) => Effect.Effect<Application, ApplicationRegistryError>
  readonly facets: () => Effect.Effect<
    ApplicationFacets,
    ApplicationRegistryError
  >
  readonly find: (
    identifier: string
  ) => Effect.Effect<Application, ApplicationRegistryError>
  readonly list: (
    input: ListApplicationsInput
  ) => Effect.Effect<ApplicationListPage, ApplicationRegistryError>
  readonly update: (
    identifier: string,
    input: UpdateApplicationInput
  ) => Effect.Effect<UpdateApplicationResult, ApplicationRegistryError>
  readonly remove: (
    identifier: string,
    expectedVersion?: number
  ) => Effect.Effect<void, ApplicationRegistryError>
}

export const ApplicationsService = Context.Service<ApplicationsService>(
  '@cv/application-registry-service/ApplicationsService'
)
