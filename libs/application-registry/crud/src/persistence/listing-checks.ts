import {
  applicationActivities,
  applicationListingCheckSchedules,
  applicationListingChecks,
  applications,
  idempotencyReceipts,
  listingCheckRuns,
} from '@cv/application-registry-entity'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  not,
  or,
  sql,
} from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure } from '../errors'
import type { RegistryDatabase, RegistryExecutor } from '../internal/connection'
import type {
  ListingCheckRunCounts,
  PersistedListingCheck,
  StartedScheduledListingCheckRun,
  StartListingCheckRun,
} from '../types'
import { allocateRevision, runTransaction } from './shared'

const checkableStatuses = ['not_started', 'preparing'] as const

const applicationVersionCondition = (
  applicationId: string,
  expectedVersion: number | undefined
) =>
  expectedVersion === undefined
    ? eq(applications.id, applicationId)
    : and(
        eq(applications.id, applicationId),
        eq(applications.version, expectedVersion)
      )

export const ensureEligibleListingCheckSchedules = (
  database: RegistryExecutor,
  now: string
) =>
  database
    .insert(applicationListingCheckSchedules)
    .select(
      database
        .select({
          applicationId: applications.id,
          attemptCount: sql<number>`0`.as('attempt_count'),
          dueAt: sql<string>`${now}`.as('due_at'),
          lastError: sql<null>`null`.as('last_error'),
          leaseToken: sql<null>`null`.as('lease_token'),
          leaseUntil: sql<null>`null`.as('lease_until'),
          updatedAt: sql<string>`${now}`.as('updated_at'),
        })
        .from(applications)
        .where(
          and(
            inArray(applications.applicationStatus, checkableStatuses),
            not(eq(applications.targetStage, 'closed_skip'))
          )
        )
    )
    .onConflictDoNothing()
    .pipe(
      Effect.mapError(
        databaseFailure('Failed to initialize listing check schedules')
      ),
      Effect.asVoid
    )

export const ensureListingCheckSchedule = (
  database: RegistryExecutor,
  applicationId: string,
  dueAt: string,
  now: string
) =>
  database
    .insert(applicationListingCheckSchedules)
    .values({ applicationId, dueAt, updatedAt: now })
    .onConflictDoNothing()
    .pipe(
      Effect.mapError(
        databaseFailure('Failed to ensure listing check schedule')
      ),
      Effect.asVoid
    )

export const claimDueListingCheckSchedules = (
  database: RegistryDatabase,
  input: {
    readonly leaseToken: string
    readonly leaseUntil: string
    readonly limit: number
    readonly now: string
  }
) =>
  runTransaction(database, 'listing check schedule claim', (transaction) =>
    Effect.gen(function* () {
      const candidates = yield* transaction
        .select({
          applicationId: applicationListingCheckSchedules.applicationId,
        })
        .from(applicationListingCheckSchedules)
        .innerJoin(
          applications,
          eq(applications.id, applicationListingCheckSchedules.applicationId)
        )
        .where(
          and(
            lte(applicationListingCheckSchedules.dueAt, input.now),
            or(
              isNull(applicationListingCheckSchedules.leaseUntil),
              lte(applicationListingCheckSchedules.leaseUntil, input.now)
            ),
            inArray(applications.applicationStatus, checkableStatuses),
            not(eq(applications.targetStage, 'closed_skip'))
          )
        )
        .orderBy(
          asc(applicationListingCheckSchedules.dueAt),
          asc(applicationListingCheckSchedules.applicationId)
        )
        .limit(input.limit)
        .for('update', {
          of: applicationListingCheckSchedules,
          skipLocked: true,
        })

      if (candidates.length === 0) {
        return []
      }

      const claimed = yield* transaction
        .update(applicationListingCheckSchedules)
        .set({
          leaseToken: input.leaseToken,
          leaseUntil: input.leaseUntil,
          updatedAt: input.now,
        })
        .where(
          and(
            inArray(
              applicationListingCheckSchedules.applicationId,
              candidates.map(({ applicationId }) => applicationId)
            ),
            lte(applicationListingCheckSchedules.dueAt, input.now),
            or(
              isNull(applicationListingCheckSchedules.leaseUntil),
              lte(applicationListingCheckSchedules.leaseUntil, input.now)
            )
          )
        )
        .returning()

      const claimedByApplicationId = new Map(
        claimed.map((schedule) => [schedule.applicationId, schedule])
      )

      return candidates.flatMap(({ applicationId }) => {
        const schedule = claimedByApplicationId.get(applicationId)
        return schedule !== undefined &&
          schedule.leaseToken !== null &&
          schedule.leaseUntil !== null
          ? [
              {
                ...schedule,
                leaseToken: schedule.leaseToken,
                leaseUntil: schedule.leaseUntil,
              },
            ]
          : []
      })
    })
  )

export const startScheduledListingCheckRun = (
  database: RegistryDatabase,
  input: {
    readonly id: string
    readonly leaseUntil: string
    readonly limit: number
    readonly mode: StartListingCheckRun['mode']
    readonly now: string
  }
) =>
  runTransaction(database, 'scheduled listing check run start', (transaction) =>
    Effect.gen(function* () {
      const candidates = yield* transaction
        .select({
          applicationId: applicationListingCheckSchedules.applicationId,
        })
        .from(applicationListingCheckSchedules)
        .innerJoin(
          applications,
          eq(applications.id, applicationListingCheckSchedules.applicationId)
        )
        .where(
          and(
            lte(applicationListingCheckSchedules.dueAt, input.now),
            or(
              isNull(applicationListingCheckSchedules.leaseUntil),
              lte(applicationListingCheckSchedules.leaseUntil, input.now)
            ),
            inArray(applications.applicationStatus, checkableStatuses),
            not(eq(applications.targetStage, 'closed_skip'))
          )
        )
        .orderBy(
          asc(applicationListingCheckSchedules.dueAt),
          asc(applicationListingCheckSchedules.applicationId)
        )
        .limit(input.limit)
        .for('update', {
          of: applicationListingCheckSchedules,
          skipLocked: true,
        })

      if (candidates.length === 0) return null

      const claimed = yield* transaction
        .update(applicationListingCheckSchedules)
        .set({
          leaseToken: input.id,
          leaseUntil: input.leaseUntil,
          updatedAt: input.now,
        })
        .where(
          inArray(
            applicationListingCheckSchedules.applicationId,
            candidates.map(({ applicationId }) => applicationId)
          )
        )
        .returning()

      if (claimed.length !== candidates.length) {
        return yield* Effect.fail(
          new Error('The scheduled listing-check claim was incomplete.')
        )
      }

      const runs = yield* transaction
        .insert(listingCheckRuns)
        .values({
          id: input.id,
          mode: input.mode,
          selectedCount: claimed.length,
          startedAt: input.now,
          state: 'running',
          trigger: 'scheduled',
        })
        .returning()
      const run = runs.at(0)
      if (run === undefined) {
        return yield* Effect.fail(
          new Error('The scheduled listing-check run was not created.')
        )
      }

      const schedules = claimed.flatMap((schedule) =>
        schedule.leaseToken === null || schedule.leaseUntil === null
          ? []
          : [
              {
                ...schedule,
                leaseToken: schedule.leaseToken,
                leaseUntil: schedule.leaseUntil,
              },
            ]
      )
      if (schedules.length !== claimed.length) {
        return yield* Effect.fail(
          new Error('The scheduled listing-check leases were not returned.')
        )
      }

      return { run, schedules } satisfies StartedScheduledListingCheckRun
    })
  )

export const failListingCheckRun = (
  database: RegistryDatabase,
  input: {
    readonly failedAt: string
    readonly failureCode: string
    readonly failureMessage: string
    readonly runId: string
  }
) =>
  runTransaction(database, 'listing check run failure', (transaction) =>
    Effect.gen(function* () {
      const failed = yield* transaction
        .update(listingCheckRuns)
        .set({
          failedAt: input.failedAt,
          failureCode: input.failureCode.slice(0, 100),
          failureMessage: input.failureMessage.slice(0, 1_000),
          state: 'failed',
        })
        .where(
          and(
            eq(listingCheckRuns.id, input.runId),
            eq(listingCheckRuns.state, 'running')
          )
        )
        .returning({ id: listingCheckRuns.id })

      if (failed.length === 0) return

      yield* transaction
        .update(applicationListingCheckSchedules)
        .set({
          leaseToken: null,
          leaseUntil: null,
          updatedAt: input.failedAt,
        })
        .where(eq(applicationListingCheckSchedules.leaseToken, input.runId))
    })
  )

export const reconcileOrphanedListingCheckRuns = (
  database: RegistryDatabase,
  input: { readonly failedAt: string; readonly staleBefore: string }
) =>
  runTransaction(
    database,
    'orphaned listing check run reconciliation',
    (transaction) =>
      Effect.gen(function* () {
        const failed = yield* transaction
          .update(listingCheckRuns)
          .set({
            failedAt: input.failedAt,
            failureCode: 'orphaned_run',
            failureMessage:
              'The runner stopped before finalizing this scheduled listing-check run.',
            state: 'failed',
          })
          .where(
            and(
              eq(listingCheckRuns.trigger, 'scheduled'),
              eq(listingCheckRuns.state, 'running'),
              lte(listingCheckRuns.startedAt, input.staleBefore)
            )
          )
          .returning({ id: listingCheckRuns.id })

        if (failed.length === 0) return 0

        yield* transaction
          .update(applicationListingCheckSchedules)
          .set({
            leaseToken: null,
            leaseUntil: null,
            updatedAt: input.failedAt,
          })
          .where(
            inArray(
              applicationListingCheckSchedules.leaseToken,
              failed.map(({ id }) => id)
            )
          )

        return failed.length
      })
  )

export const failListingCheckClaim = (
  database: RegistryExecutor,
  input: {
    readonly applicationId: string
    readonly error: string
    readonly leaseToken: string
    readonly nextAttemptAt: string
    readonly now: string
  }
) =>
  database
    .update(applicationListingCheckSchedules)
    .set({
      attemptCount: sql`${applicationListingCheckSchedules.attemptCount} + 1`,
      dueAt: input.nextAttemptAt,
      lastError: input.error.slice(0, 1000),
      leaseToken: null,
      leaseUntil: null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(applicationListingCheckSchedules.applicationId, input.applicationId),
        eq(applicationListingCheckSchedules.leaseToken, input.leaseToken)
      )
    )
    .pipe(
      Effect.mapError(
        databaseFailure('Failed to record listing check failure')
      ),
      Effect.asVoid
    )

export const findListingCheckByOperation = (
  database: RegistryExecutor,
  operationId: string
) =>
  database
    .select()
    .from(applicationListingChecks)
    .where(eq(applicationListingChecks.operationId, operationId))
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to find listing check'))
    )

export const listApplicationListingChecks = (
  database: RegistryExecutor,
  applicationId: string
) =>
  database
    .select()
    .from(applicationListingChecks)
    .where(eq(applicationListingChecks.applicationId, applicationId))
    .orderBy(
      desc(applicationListingChecks.checkedAt),
      desc(applicationListingChecks.id)
    )
    .pipe(Effect.mapError(databaseFailure('Failed to list application checks')))

export const listListingChecksByRun = (
  database: RegistryExecutor,
  runId: string
) =>
  database
    .select()
    .from(applicationListingChecks)
    .where(eq(applicationListingChecks.runId, runId))
    .orderBy(asc(applicationListingChecks.id))
    .pipe(Effect.mapError(databaseFailure('Failed to list run checks')))

export const findListingCheckRun = (
  database: RegistryExecutor,
  runId: string
) =>
  database
    .select()
    .from(listingCheckRuns)
    .where(eq(listingCheckRuns.id, runId))
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to find listing check run'))
    )

export const startListingCheckRun = (
  database: RegistryExecutor,
  input: StartListingCheckRun
) =>
  database
    .insert(listingCheckRuns)
    .values({
      ...input,
      state: 'running',
    })
    .onConflictDoNothing()
    .pipe(
      Effect.mapError(databaseFailure('Failed to start listing check run')),
      Effect.asVoid
    )

export const updateListingCheckRunCounts = (
  database: RegistryExecutor,
  runId: string,
  counts: ListingCheckRunCounts
) =>
  database
    .update(listingCheckRuns)
    .set(counts)
    .where(eq(listingCheckRuns.id, runId))
    .pipe(
      Effect.mapError(databaseFailure('Failed to update listing check counts')),
      Effect.asVoid
    )

export const completeListingCheckRun = (
  database: RegistryExecutor,
  runId: string,
  counts: ListingCheckRunCounts,
  completedAt: string
) =>
  database
    .update(listingCheckRuns)
    .set({ ...counts, completedAt, state: 'completed' })
    .where(
      and(eq(listingCheckRuns.id, runId), eq(listingCheckRuns.state, 'running'))
    )
    .returning({ id: listingCheckRuns.id })
    .pipe(
      Effect.mapError(databaseFailure('Failed to complete listing check run')),
      Effect.flatMap((rows) =>
        rows.length === 1
          ? Effect.void
          : Effect.fail(
              databaseFailure('Failed to complete listing check run')(
                new Error(`Listing check run ${runId} is not running.`)
              )
            )
      )
    )

export const persistListingCheck = (
  database: RegistryDatabase,
  input: PersistedListingCheck
) => {
  const {
    archiveApplication,
    claimedLeaseToken,
    closedCandidateAt,
    consecutiveClosedChecks,
    activityId,
    expectedVersion,
    listingAvailability,
    requestHash,
    recordedAt,
    ...listingCheck
  } = input

  return runTransaction(database, 'listing check', (transaction) =>
    Effect.gen(function* () {
      const application = yield* transaction
        .select({
          id: applications.id,
          version: applications.version,
        })
        .from(applications)
        .where(
          applicationVersionCondition(
            listingCheck.applicationId,
            expectedVersion
          )
        )
        .limit(1)
        .for('update')
        .pipe(Effect.map((rows) => rows.at(0)))

      if (application === undefined) {
        return false
      }

      if (claimedLeaseToken !== undefined) {
        const claim = yield* transaction
          .select({
            applicationId: applicationListingCheckSchedules.applicationId,
          })
          .from(applicationListingCheckSchedules)
          .where(
            and(
              eq(
                applicationListingCheckSchedules.applicationId,
                listingCheck.applicationId
              ),
              eq(
                applicationListingCheckSchedules.leaseToken,
                claimedLeaseToken
              ),
              gt(
                applicationListingCheckSchedules.leaseUntil,
                sql`CURRENT_TIMESTAMP`
              )
            )
          )
          .limit(1)
          .for('update')
          .pipe(Effect.map((rows) => rows.at(0)))

        if (claim === undefined) {
          return false
        }
      }

      yield* transaction.insert(idempotencyReceipts).values({
        applicationId: listingCheck.applicationId,
        idempotencyKey: listingCheck.operationId,
        requestHash,
        scope: 'listing_check',
        resourceId: listingCheck.id,
        createdAt: recordedAt,
      })

      const revision = yield* allocateRevision(transaction)

      yield* transaction
        .insert(applicationListingChecks)
        .values({ ...listingCheck, evidence: listingCheck.evidence })

      if (activityId !== null) {
        yield* transaction.insert(applicationActivities).values({
          applicationId: listingCheck.applicationId,
          actor: 'automation',
          source: 'listing_checker',
          id: activityId,
          kind: 'listing_availability_changed',
          occurredAt: listingCheck.checkedAt,
          payload: {
            listingCheckId: listingCheck.id,
            availability: listingAvailability,
            reasonCode: listingCheck.reasonCode,
          },
          revision,
        })
      }

      const scheduleUpdates = yield* transaction
        .update(applicationListingCheckSchedules)
        .set({
          attemptCount: 0,
          dueAt: listingCheck.nextCheckAt,
          lastError: null,
          leaseToken: null,
          leaseUntil: null,
          updatedAt: recordedAt,
        })
        .where(
          claimedLeaseToken === undefined
            ? eq(
                applicationListingCheckSchedules.applicationId,
                listingCheck.applicationId
              )
            : and(
                eq(
                  applicationListingCheckSchedules.applicationId,
                  listingCheck.applicationId
                ),
                eq(
                  applicationListingCheckSchedules.leaseToken,
                  claimedLeaseToken
                ),
                gt(
                  applicationListingCheckSchedules.leaseUntil,
                  sql`CURRENT_TIMESTAMP`
                )
              )
        )
        .returning({
          applicationId: applicationListingCheckSchedules.applicationId,
        })

      if (claimedLeaseToken !== undefined && scheduleUpdates.length !== 1) {
        return yield* Effect.fail(
          new Error('The claimed listing-check schedule could not be advanced.')
        )
      }

      yield* transaction
        .update(applications)
        .set({
          ...(archiveApplication
            ? {
                applicationStatus: sql`case when ${applications.applicationStatus} in ('not_started', 'preparing') then 'archived' else ${applications.applicationStatus} end`,
              }
            : {}),
          listingAvailability,
          listingCheckedAt: listingCheck.checkedAt,
          listingClosedCandidateAt: closedCandidateAt,
          listingConfidence: listingCheck.confidence,
          listingConsecutiveClosedChecks: consecutiveClosedChecks,
          listingReasonCode: listingCheck.reasonCode,
          updatedAt: recordedAt,
          updatedRevision: revision,
          version: sql`${applications.version} + 1`,
        })
        .where(eq(applications.id, application.id))

      return true
    })
  )
}
