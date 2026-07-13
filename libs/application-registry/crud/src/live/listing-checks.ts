import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'

import { withRegistryConnections } from '../internal/connection'
import {
  claimDueListingCheckSchedules,
  completeListingCheckRun,
  ensureEligibleListingCheckSchedules,
  ensureListingCheckSchedule,
  failListingCheckClaim,
  findListingCheckByOperation,
  findListingCheckRun,
  listApplicationListingChecks,
  listListingChecksByRun,
  persistListingCheck,
  startListingCheckRun,
  updateListingCheckRunCounts,
} from '../persistence/listing-checks'
import { ListingChecksCrud } from '../services/listing-checks'

export const makeListingChecksCrudLive = (
  database: Effect.Effect<D1Database>
) =>
  Layer.succeed(ListingChecksCrud, {
    claimDue: (input) =>
      withRegistryConnections(database, (connections) =>
        claimDueListingCheckSchedules(connections, input)
      ),
    completeRun: (runId, counts, completedAt) =>
      withRegistryConnections(database, (connections) =>
        completeListingCheckRun(connections, runId, counts, completedAt)
      ),
    ensureEligibleSchedules: (now) =>
      withRegistryConnections(database, (connections) =>
        ensureEligibleListingCheckSchedules(connections, now)
      ),
    ensureSchedule: (applicationId, dueAt, now) =>
      withRegistryConnections(database, (connections) =>
        ensureListingCheckSchedule(connections, applicationId, dueAt, now)
      ),
    failClaim: (input) =>
      withRegistryConnections(database, (connections) =>
        failListingCheckClaim(connections, input)
      ),
    findByOperation: (operationId) =>
      withRegistryConnections(database, ({ query }) =>
        findListingCheckByOperation(query, operationId)
      ),
    findRun: (runId) =>
      withRegistryConnections(database, ({ query }) =>
        findListingCheckRun(query, runId)
      ),
    listByApplication: (applicationId) =>
      withRegistryConnections(database, ({ query }) =>
        listApplicationListingChecks(query, applicationId)
      ),
    listByRun: (runId) =>
      withRegistryConnections(database, ({ query }) =>
        listListingChecksByRun(query, runId)
      ),
    persist: (input) =>
      withRegistryConnections(database, (connections) =>
        persistListingCheck(connections, input)
      ),
    startRun: (input) =>
      withRegistryConnections(database, (connections) =>
        startListingCheckRun(connections, input)
      ),
    updateRunCounts: (runId, counts) =>
      withRegistryConnections(database, (connections) =>
        updateListingCheckRunCounts(connections, runId, counts)
      ),
  })
