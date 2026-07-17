import type {
  ApplicationListingCheck,
  ListingCheckRun,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  CheckListingResult,
  ResolveListingAvailabilityInput,
  RunDueListingChecksInput,
  RunDueListingChecksResult,
  SubmitListingCheckFindingsInput,
  SubmitListingCheckFindingsResult,
} from '../types'

export interface ListingChecksService {
  readonly findRun: (
    runId: string
  ) => Effect.Effect<ListingCheckRun, ApplicationRegistryError>
  readonly listByApplication: (
    identifier: string
  ) => Effect.Effect<
    { readonly items: readonly ApplicationListingCheck[] },
    ApplicationRegistryError
  >
  readonly resolveAvailability: (
    identifier: string,
    input: ResolveListingAvailabilityInput
  ) => Effect.Effect<CheckListingResult, ApplicationRegistryError>
  readonly runDue: (
    input: RunDueListingChecksInput
  ) => Effect.Effect<RunDueListingChecksResult, ApplicationRegistryError>
  readonly submitFindings: (
    input: SubmitListingCheckFindingsInput
  ) => Effect.Effect<SubmitListingCheckFindingsResult, ApplicationRegistryError>
}

export const ListingChecksService = Context.Service<ListingChecksService>(
  '@cv/application-registry-service/ListingChecksService'
)
