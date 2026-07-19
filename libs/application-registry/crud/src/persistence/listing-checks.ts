import {
  applicationActivities,
  applicationListingCheckSchedules,
  applicationListingChecks,
  applications,
  idempotencyReceipts,
  listingCheckRuns,
  registrySequence,
} from '@cv/application-registry-entity'
import {
  and,
  asc,
  desc,
  eq,
  exists,
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
import { currentRevision, runBatch } from './shared'

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

const listingCheckReceiptMatches = (
  database: RegistryConnections['batch'],
  applicationId: string,
  idempotencyKey: string,
  requestHash: string
) =>
  exists(
    database
      .select({ idempotencyKey: idempotencyReceipts.idempotencyKey })
      .from(idempotencyReceipts)
      .where(
        and(
          eq(idempotencyReceipts.applicationId, applicationId),
          eq(idempotencyReceipts.scope, 'listing_check'),
          eq(idempotencyReceipts.idempotencyKey, idempotencyKey),
          eq(idempotencyReceipts.requestHash, requestHash)
        )
      )
  )

const allocateListingCheckRevision = (
  database: RegistryConnections['batch'],
  applicationId: string,
  expectedVersion: number | undefined
) =>
  database
    .insert(registrySequence)
    .select(
      database
        .select({
          id: sql<number>`1`.as('id'),
          revision: sql<number>`1`.as('revision'),
        })
        .from(applications)
        .where(applicationVersionCondition(applicationId, expectedVersion))
    )
    .onConflictDoUpdate({
      target: registrySequence.id,
      set: { revision: sql`${registrySequence.revision} + 1` },
    })

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
    activityId,
    expectedVersion,
    listingAvailability,
    requestHash,
    recordedAt,
    ...listingCheck
  } = input
  const receiptMatches = listingCheckReceiptMatches(
    database.batch,
    listingCheck.applicationId,
    listingCheck.operationId,
    requestHash
  )
  const versionMatches = applicationVersionCondition(
    listingCheck.applicationId,
    expectedVersion
  )
  const receiptInsert = database.batch.insert(idempotencyReceipts).select(
    database.batch
      .select({
        applicationId: applications.id,
        idempotencyKey: sql<string>`${listingCheck.operationId}`.as(
          'idempotency_key'
        ),
        requestHash: sql<string>`${requestHash}`.as('request_hash'),
        scope: sql<'listing_check'>`'listing_check'`.as('scope'),
        resourceId: sql<string>`${listingCheck.id}`.as('resource_id'),
        createdAt: sql<string>`${recordedAt}`.as('created_at'),
      })
      .from(applications)
      .where(versionMatches)
  )
  const listingCheckInsert = database.batch
    .insert(applicationListingChecks)
    .select(
      database.batch
        .select({
          applicationId: applications.id,
          checkedAt: sql<string>`${listingCheck.checkedAt}`.as('checked_at'),
          checkerVersion: sql<string>`${listingCheck.checkerVersion}`.as(
            'checker_version'
          ),
          confidence: sql`${listingCheck.confidence}`.as('confidence'),
          contentHash: sql<string | null>`${listingCheck.contentHash}`.as(
            'content_hash'
          ),
          evidence: sql`${JSON.stringify(listingCheck.evidence)}`.as(
            'evidence'
          ),
          finalUrl: sql<string | null>`${listingCheck.finalUrl}`.as(
            'final_url'
          ),
          httpStatus: sql<number | null>`${listingCheck.httpStatus}`.as(
            'http_status'
          ),
          id: sql<string>`${listingCheck.id}`.as('id'),
          nextCheckAt: sql<string>`${listingCheck.nextCheckAt}`.as(
            'next_check_at'
          ),
          operationId: sql<string>`${listingCheck.operationId}`.as(
            'operation_id'
          ),
          outcome: sql`${listingCheck.outcome}`.as('outcome'),
          provider: sql<string>`${listingCheck.provider}`.as('provider'),
          reasonCode: sql`${listingCheck.reasonCode}`.as('reason_code'),
          receivedAt: sql<string>`${listingCheck.receivedAt}`.as('received_at'),
          recommendedAction: sql`${listingCheck.recommendedAction}`.as(
            'recommended_action'
          ),
          requestedUrl: sql<string>`${listingCheck.requestedUrl}`.as(
            'requested_url'
          ),
          runId: sql<string | null>`${listingCheck.runId}`.as('run_id'),
        })
        .from(applications)
        .where(and(versionMatches, receiptMatches))
    )
  const activityInsert = database.batch.insert(applicationActivities).select(
    database.batch
      .select({
        applicationId: applications.id,
        actor: sql<'automation'>`'automation'`.as('actor'),
        source: sql<'listing_checker'>`'listing_checker'`.as('source'),
        id: sql<string>`${activityId}`.as('id'),
        kind: sql<'listing_availability_changed'>`'listing_availability_changed'`.as(
          'kind'
        ),
        occurredAt: sql<string>`${listingCheck.checkedAt}`.as('occurred_at'),
        payload: sql`${JSON.stringify({
          listingCheckId: listingCheck.id,
          availability: listingAvailability,
          reasonCode: listingCheck.reasonCode,
        })}`.as('payload'),
        revision: currentRevision.as('revision'),
      })
      .from(applications)
      .where(
        and(versionMatches, receiptMatches, sql`${activityId} is not null`)
      )
  )

  const statements = [
    allocateListingCheckRevision(
      database.batch,
      listingCheck.applicationId,
      expectedVersion
    ),
    receiptInsert,
    listingCheckInsert,
    ...(activityId === null ? [] : [activityInsert]),
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
        and(
          eq(
            applicationListingCheckSchedules.applicationId,
            listingCheck.applicationId
          ),
          receiptMatches
        )
      ),
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
      .where(and(versionMatches, receiptMatches)),
  ] as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(database.batch, 'listing check', statements).pipe(
    Effect.map((results) => (results.at(-1)?.meta.changes ?? 0) > 0)
  )
}
