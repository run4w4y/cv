import type {
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

export type {
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'

export interface ListingAvailabilityChecker {
  readonly check: (
    target: ListingCheckTarget
  ) => Effect.Effect<ListingObservation>
}

export const ListingAvailabilityChecker =
  Context.Service<ListingAvailabilityChecker>(
    '@cv/application-registry-listing-check/ListingAvailabilityChecker'
  )
