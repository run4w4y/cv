import type {
  ApplicationListingCheck,
  ListingCheckRun,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type {
  ClaimedListingCheckSchedule,
  ListingCheckRunCounts,
  PersistedListingCheck,
  StartListingCheckRun,
} from '../types'

export interface ListingChecksCrud {
  readonly claimDue: (input: {
    readonly leaseToken: string
    readonly leaseUntil: string
    readonly limit: number
    readonly now: string
  }) => Effect.Effect<
    readonly ClaimedListingCheckSchedule[],
    RegistryDatabaseError
  >
  readonly completeRun: (
    runId: string,
    counts: ListingCheckRunCounts,
    completedAt: string
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly ensureEligibleSchedules: (
    now: string
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly ensureSchedule: (
    applicationId: string,
    dueAt: string,
    now: string
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly failClaim: (input: {
    readonly applicationId: string
    readonly error: string
    readonly leaseToken: string
    readonly nextAttemptAt: string
    readonly now: string
  }) => Effect.Effect<void, RegistryDatabaseError>
  readonly findByOperation: (
    operationId: string
  ) => Effect.Effect<ApplicationListingCheck | undefined, RegistryDatabaseError>
  readonly findRun: (
    runId: string
  ) => Effect.Effect<ListingCheckRun | undefined, RegistryDatabaseError>
  readonly listByApplication: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationListingCheck[], RegistryDatabaseError>
  readonly listByRun: (
    runId: string
  ) => Effect.Effect<readonly ApplicationListingCheck[], RegistryDatabaseError>
  readonly persist: (
    input: PersistedListingCheck
  ) => Effect.Effect<boolean, RegistryDatabaseError>
  readonly startRun: (
    input: StartListingCheckRun
  ) => Effect.Effect<void, RegistryDatabaseError>
  readonly updateRunCounts: (
    runId: string,
    counts: ListingCheckRunCounts
  ) => Effect.Effect<void, RegistryDatabaseError>
}

export const ListingChecksCrud = Context.Service<ListingChecksCrud>(
  '@cv/application-registry-crud/ListingChecksCrud'
)
