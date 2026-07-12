import type {
  Application,
  ApplicationStatus,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type {
  ApplicationListFilter,
  ApplicationPatch,
  CrudPage,
  PersistApplicationOptions,
  PersistedApplication,
  PersistedEvent,
} from '../types'

export interface ApplicationsCrud {
  readonly findByIdentifier: (
    identifier: string
  ) => Effect.Effect<Application | undefined, RegistryDatabaseError>
  readonly findByJobKey: (
    jobKey: string
  ) => Effect.Effect<Application | undefined, RegistryDatabaseError>
  readonly list: (
    filter: ApplicationListFilter
  ) => Effect.Effect<CrudPage<Application>, RegistryDatabaseError>
  readonly patch: (
    applicationId: string,
    patch: ApplicationPatch,
    recordedAt: string
  ) => Effect.Effect<Application | undefined, RegistryDatabaseError>
  readonly persist: (
    input: PersistedApplication,
    options: PersistApplicationOptions
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly persistEvent: (
    applicationId: string,
    expectedVersion: number,
    nextApplicationStatus: ApplicationStatus | undefined,
    input: PersistedEvent
  ) => Effect.Effect<boolean, RegistryDatabaseError>
  readonly remove: (
    applicationId: string
  ) => Effect.Effect<boolean, RegistryDatabaseError>
}

export const ApplicationsCrud = Context.Service<ApplicationsCrud>(
  '@cv/application-registry-crud/ApplicationsCrud'
)
