import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  RunDueListingChecksInput,
  RunDueListingChecksResult,
} from '../types'

/** The one-shot scheduled workflow. It is intentionally not part of the HTTP API service. */
export interface ScheduledListingChecksRunner {
  readonly runOnce: (
    input: RunDueListingChecksInput
  ) => Effect.Effect<RunDueListingChecksResult, ApplicationRegistryError>
}

export const ScheduledListingChecksRunner =
  Context.Service<ScheduledListingChecksRunner>(
    '@cv/application-registry-service/ScheduledListingChecksRunner'
  )
