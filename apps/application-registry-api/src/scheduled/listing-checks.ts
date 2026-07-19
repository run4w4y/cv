import { ListingChecksService } from '@cv/application-registry-service'
import { Effect } from 'effect'

import { makeRegistryServiceLayer } from '../layers/registry'
import { WorkerEnv } from '../worker/bindings'
import {
  type ListingChecksConfiguration,
  provideWorkerConfiguration,
  readListingChecksConfiguration,
} from '../worker/config'
import type { ApplicationRegistryEnv } from '../worker/types'

export const scheduledListingCheckInput = (
  configuration: ListingChecksConfiguration
) => ({
  limit: configuration.batchSize,
  mode: configuration.archiveEnabled
    ? ('archive_eligible' as const)
    : ('report' as const),
})

export const runScheduledListingChecksEffect = Effect.fn(
  'ListingChecks.runScheduled'
)(function* (configuration: ListingChecksConfiguration) {
  if (!configuration.enabled) return

  const listingChecks = yield* ListingChecksService
  return yield* listingChecks.runDue(scheduledListingCheckInput(configuration))
})

export const runScheduledListingChecks = (env: ApplicationRegistryEnv) =>
  readListingChecksConfiguration.pipe(
    provideWorkerConfiguration(env),
    Effect.flatMap(runScheduledListingChecksEffect),
    Effect.provide(makeRegistryServiceLayer(env)),
    Effect.provide(WorkerEnv.context(env)),
    Effect.runPromise
  )
