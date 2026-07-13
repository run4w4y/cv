import {
  applicationEvents,
  applicationListingCheckSchedules,
  applicationListingChecks,
  applications,
  listingCheckRuns,
} from '@cv/application-registry-entity'
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  not,
  or,
  sql,
} from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'

import { databaseFailure } from '../errors'
import type { RegistryConnections } from '../internal/connection'
import type {
  ListingCheckRunCounts,
  PersistedListingCheck,
  StartListingCheckRun,
} from '../types'
import { allocateRevision, currentRevision, runBatch } from './shared'

const checkableStatuses = ['not_started', 'preparing'] as const

export const ensureEligibleListingCheckSchedules = (
  database: RegistryConnections,
  now: string
) =>
  runBatch(database.batch, 'listing check schedule initialization', [
    database.batch
      .insert(applicationListingCheckSchedules)
      .select(
        database.batch
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
      .onConflictDoNothing(),
  ]).pipe(Effect.asVoid)

export const ensureListingCheckSchedule = (
  database: RegistryConnections,
  applicationId: string,
  dueAt: string,
  now: string
) =>
  runBatch(database.batch, 'listing check schedule upsert', [
    database.batch
      .insert(applicationListingCheckSchedules)
      .values({ applicationId, dueAt, updatedAt: now })
      .onConflictDoNothing(),
  ]).pipe(Effect.asVoid)

export const claimDueListingCheckSchedules = (
  database: RegistryConnections,
  input: {
    readonly leaseToken: string
    readonly leaseUntil: string
    readonly limit: number
    readonly now: string
  }
) =>
  Effect.gen(function* () {
    const candidates = yield* database.query
      .select({ applicationId: applicationListingCheckSchedules.applicationId })
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
            lt(applicationListingCheckSchedules.leaseUntil, input.now)
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
      .pipe(
        Effect.mapError(databaseFailure('Failed to find due listing checks'))
      )

    const claimed = yield* Effect.forEach(
      candidates,
      ({ applicationId }) =>
        database.query
          .update(applicationListingCheckSchedules)
          .set({
            leaseToken: input.leaseToken,
            leaseUntil: input.leaseUntil,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(applicationListingCheckSchedules.applicationId, applicationId),
              lte(applicationListingCheckSchedules.dueAt, input.now),
              or(
                isNull(applicationListingCheckSchedules.leaseUntil),
                lt(applicationListingCheckSchedules.leaseUntil, input.now)
              )
            )
          )
          .returning()
          .pipe(
            Effect.map((rows) => rows.at(0)),
            Effect.mapError(databaseFailure('Failed to claim listing check'))
          ),
      { concurrency: 1 }
    )

    return claimed.flatMap((schedule) =>
      schedule?.leaseToken && schedule.leaseUntil
        ? [
            {
              ...schedule,
              leaseToken: schedule.leaseToken,
              leaseUntil: schedule.leaseUntil,
            },
          ]
        : []
    )
  })

export const failListingCheckClaim = (
  database: RegistryConnections,
  input: {
    readonly applicationId: string
    readonly error: string
    readonly leaseToken: string
    readonly nextAttemptAt: string
    readonly now: string
  }
) =>
  runBatch(database.batch, 'listing check claim failure', [
    database.batch
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
          eq(
            applicationListingCheckSchedules.applicationId,
            input.applicationId
          ),
          eq(applicationListingCheckSchedules.leaseToken, input.leaseToken)
        )
      ),
  ]).pipe(Effect.asVoid)

export const findListingCheckByOperation = (
  database: RegistryConnections['query'],
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
  database: RegistryConnections['query'],
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
  database: RegistryConnections['query'],
  runId: string
) =>
  database
    .select()
    .from(applicationListingChecks)
    .where(eq(applicationListingChecks.runId, runId))
    .orderBy(asc(applicationListingChecks.id))
    .pipe(Effect.mapError(databaseFailure('Failed to list run checks')))

export const findListingCheckRun = (
  database: RegistryConnections['query'],
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
  database: RegistryConnections,
  input: StartListingCheckRun
) =>
  runBatch(database.batch, 'listing check run start', [
    database.batch
      .insert(listingCheckRuns)
      .values({
        ...input,
        state: 'running',
      })
      .onConflictDoNothing(),
  ]).pipe(Effect.asVoid)

export const updateListingCheckRunCounts = (
  database: RegistryConnections,
  runId: string,
  counts: ListingCheckRunCounts
) =>
  runBatch(database.batch, 'listing check run count update', [
    database.batch
      .update(listingCheckRuns)
      .set(counts)
      .where(eq(listingCheckRuns.id, runId)),
  ]).pipe(Effect.asVoid)

export const completeListingCheckRun = (
  database: RegistryConnections,
  runId: string,
  counts: ListingCheckRunCounts,
  completedAt: string
) =>
  runBatch(database.batch, 'listing check run completion', [
    database.batch
      .update(listingCheckRuns)
      .set({ ...counts, completedAt, state: 'completed' })
      .where(eq(listingCheckRuns.id, runId)),
  ]).pipe(Effect.asVoid)

export const persistListingCheck = (
  database: RegistryConnections,
  input: PersistedListingCheck
) => {
  const {
    archiveApplication,
    closedCandidateAt,
    consecutiveClosedChecks,
    eventId,
    listingAvailability,
    recordedAt,
    ...listingCheck
  } = input
  const eventInsert = database.batch.insert(applicationEvents).select(
    database.batch
      .select({
        applicationId: applications.id,
        deviceId: sql<null>`null`.as('device_id'),
        id: sql<string>`${eventId}`.as('id'),
        kind: sql<'listing_closed'>`'listing_closed'`.as('kind'),
        occurredAt: sql<string>`${listingCheck.checkedAt}`.as('occurred_at'),
        operationId: sql<string>`${`${listingCheck.operationId}:closed`}`.as(
          'operation_id'
        ),
        payload: sql`${JSON.stringify({
          listingCheckId: listingCheck.id,
          reasonCode: listingCheck.reasonCode,
        })}`.as('payload'),
        recordedAt: sql<string>`${recordedAt}`.as('recorded_at'),
        revision: currentRevision.as('revision'),
      })
      .from(applications)
      .where(
        and(
          eq(applications.id, input.applicationId),
          inArray(applications.applicationStatus, checkableStatuses)
        )
      )
  )

  const statements = [
    allocateRevision(database.batch),
    database.batch.insert(applicationListingChecks).values(listingCheck),
    ...(archiveApplication && eventId !== null ? [eventInsert] : []),
    database.batch
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
        updatedRevision: currentRevision,
        version: sql`${applications.version} + 1`,
      })
      .where(eq(applications.id, listingCheck.applicationId)),
    database.batch
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
        eq(
          applicationListingCheckSchedules.applicationId,
          listingCheck.applicationId
        )
      ),
  ] as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(database.batch, 'listing check', statements).pipe(
    Effect.map((results) => (results.at(-2)?.meta.changes ?? 0) > 0)
  )
}
