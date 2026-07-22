import { Layer } from 'effect'

import type { RegistryDatabase } from '../internal/connection'
import {
  claimDueListingCheckSchedules,
  completeListingCheckRun,
  ensureEligibleListingCheckSchedules,
  ensureListingCheckSchedule,
  failListingCheckClaim,
  failListingCheckRun,
  findListingCheckByOperation,
  findListingCheckRun,
  listApplicationListingChecks,
  listListingChecksByRun,
  persistListingCheck,
  reconcileOrphanedListingCheckRuns,
  startListingCheckRun,
  startScheduledListingCheckRun,
  updateListingCheckRunCounts,
} from '../persistence/listing-checks'
import { ListingChecksCrud } from '../services/listing-checks'

export const makeListingChecksCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(ListingChecksCrud, {
    claimDue: (input) => claimDueListingCheckSchedules(database, input),
    completeRun: (runId, counts, completedAt) =>
      completeListingCheckRun(database, runId, counts, completedAt),
    ensureEligibleSchedules: (now) =>
      ensureEligibleListingCheckSchedules(database, now),
    ensureSchedule: (applicationId, dueAt, now) =>
      ensureListingCheckSchedule(database, applicationId, dueAt, now),
    failClaim: (input) => failListingCheckClaim(database, input),
    failRun: (input) => failListingCheckRun(database, input),
    findByOperation: (operationId) =>
      findListingCheckByOperation(database, operationId),
    findRun: (runId) => findListingCheckRun(database, runId),
    listByApplication: (applicationId) =>
      listApplicationListingChecks(database, applicationId),
    listByRun: (runId) => listListingChecksByRun(database, runId),
    persist: (input) => persistListingCheck(database, input),
    reconcileOrphanedRuns: (input) =>
      reconcileOrphanedListingCheckRuns(database, input),
    startRun: (input) => startListingCheckRun(database, input),
    startScheduledRun: (input) =>
      startScheduledListingCheckRun(database, input),
    updateRunCounts: (runId, counts) =>
      updateListingCheckRunCounts(database, runId, counts),
  })
