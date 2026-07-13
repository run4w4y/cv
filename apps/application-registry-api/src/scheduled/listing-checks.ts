import { ListingChecksService } from '@cv/application-registry-service'
import { Effect } from 'effect'

import { RegistryServiceLayer } from '../layers/registry'
import { WorkerEnv } from '../worker/bindings'
import type { ApplicationRegistryEnv } from '../worker/types'

const defaultBatchSize = 5
const maximumBatchSize = 10

const batchSize = (value: string | undefined) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximumBatchSize)
    : defaultBatchSize
}

export const listingChecksAreEnabled = (env: ApplicationRegistryEnv) =>
  env.LISTING_CHECKS_ENABLED !== 'false'

export const scheduledListingCheckInput = (env: ApplicationRegistryEnv) => ({
  limit: batchSize(env.LISTING_CHECK_BATCH_SIZE),
  mode:
    env.LISTING_CHECK_ARCHIVE_ENABLED === 'true'
      ? ('archive_eligible' as const)
      : ('report' as const),
})

export const runScheduledListingChecks = (env: ApplicationRegistryEnv) =>
  Effect.gen(function* () {
    const listingChecks = yield* ListingChecksService
    return yield* listingChecks.runDue(scheduledListingCheckInput(env))
  }).pipe(
    Effect.provide(RegistryServiceLayer),
    Effect.provide(WorkerEnv.context(env)),
    Effect.runPromise
  )
