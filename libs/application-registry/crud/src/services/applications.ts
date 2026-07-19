import type { Application } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type {
  RegistryDatabaseError,
  RegistryQueryTooComplexError,
} from '../errors'
import type {
  ApplicationFacets,
  ApplicationListPage,
  ApplicationListResolution,
  ApplicationPatch,
  PersistApplicationOptions,
  PersistedApplication,
  PersistedManagedApplicationUpdate,
} from '../types'

export interface ApplicationsCrud {
  readonly facets: () => Effect.Effect<ApplicationFacets, RegistryDatabaseError>
  readonly findByIdentifier: (
    identifier: string
  ) => Effect.Effect<Application | undefined, RegistryDatabaseError>
  readonly findByPostingFingerprint: (
    fingerprint: string
  ) => Effect.Effect<Application | undefined, RegistryDatabaseError>
  readonly findByPostingUrl: (
    postingUrlNormalized: string
  ) => Effect.Effect<readonly Application[], RegistryDatabaseError>
  readonly list: (
    query: ApplicationListResolution
  ) => Effect.Effect<
    ApplicationListPage,
    RegistryDatabaseError | RegistryQueryTooComplexError
  >
  readonly patch: (
    applicationId: string,
    patch: ApplicationPatch,
    recordedAt: string
  ) => Effect.Effect<Application | undefined, RegistryDatabaseError>
  readonly updateManaged: (
    applicationId: string,
    input: PersistedManagedApplicationUpdate
  ) => Effect.Effect<boolean, RegistryDatabaseError>
  readonly persist: (
    input: PersistedApplication,
    options: PersistApplicationOptions
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly remove: (
    applicationId: string,
    expectedVersion?: number
  ) => Effect.Effect<boolean, RegistryDatabaseError>
}

export const ApplicationsCrud = Context.Service<ApplicationsCrud>(
  '@cv/application-registry-crud/ApplicationsCrud'
)
