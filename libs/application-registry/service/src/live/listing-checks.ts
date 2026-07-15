import {
  ApplicationsCrud,
  CapturesCrud,
  EventsCrud,
  type ListingCheckRunCounts,
  ListingChecksCrud,
} from '@cv/application-registry-crud'
import type {
  Application,
  ApplicationListingCheck,
  ListingObservation,
} from '@cv/application-registry-entity'
import { ListingAvailabilityChecker } from '@cv/application-registry-listing-check'
import { Effect, Layer } from 'effect'
import { countBy, partition, sumBy } from 'es-toolkit'

import { RegistryConflictError, RegistryNotFoundError } from '../errors'
import { decideListingCheck } from '../internal/listing-check-policy'
import {
  findRequiredApplication,
  newRegistryId,
  registryNow,
} from '../internal/shared'
import {
  ListingChecksService,
  type ListingChecksService as ListingChecksServiceShape,
} from '../services/listing-checks'
import type {
  CheckListingResult,
  RecordListingObservationInput,
  RunDueListingChecksInput,
  SubmitListingCheckFindingsInput,
} from '../types'

const addMinutes = (value: string, minutes: number) =>
  new Date(Date.parse(value) + minutes * 60 * 1000).toISOString()

const retryDelayMinutes = (attemptCount: number) =>
  Math.min(24 * 60, 30 * 2 ** Math.min(attemptCount, 5))

const mergeUnknownEvidence = (
  authoritative: ListingObservation,
  canonical: ListingObservation
): ListingObservation =>
  canonical.outcome === 'open'
    ? canonical
    : {
        ...authoritative,
        evidence: [...authoritative.evidence, ...canonical.evidence],
      }

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const captures = yield* CapturesCrud
  const checks = yield* ListingChecksCrud
  const checker = yield* ListingAvailabilityChecker
  const events = yield* EventsCrud

  const loadCheckResult = (
    applicationId: string,
    check: ApplicationListingCheck,
    replayed: boolean,
    statusBefore: Application['applicationStatus']
  ) =>
    Effect.gen(function* () {
      const application = yield* findRequiredApplication(
        applications,
        applicationId
      )
      const closureEvent = replayed
        ? yield* events.findByOperation(`${check.operationId}:closed`)
        : undefined
      return {
        application,
        archived:
          closureEvent !== undefined ||
          (statusBefore !== 'archived' &&
            application.applicationStatus === 'archived'),
        check,
        replayed,
      } satisfies CheckListingResult
    })

  const observe = (application: Application) =>
    Effect.gen(function* () {
      const captureItems = yield* captures.listByApplication(application.id)
      const authoritativeUrl = captureItems.at(-1)?.applicationUrl ?? null
      if (
        authoritativeUrl !== null &&
        authoritativeUrl !== application.canonicalUrl
      ) {
        const authoritative = yield* checker.check({
          company: application.company,
          role: application.role,
          url: authoritativeUrl,
        })
        if (authoritative.outcome !== 'unknown') return authoritative
        const canonical = yield* checker.check({
          company: application.company,
          role: application.role,
          url: application.canonicalUrl,
        })
        return mergeUnknownEvidence(authoritative, canonical)
      }
      return yield* checker.check({
        company: application.company,
        role: application.role,
        url: application.canonicalUrl,
      })
    })

  const recordObservation = (
    application: Application,
    input: RecordListingObservationInput
  ) =>
    Effect.gen(function* () {
      const replay = yield* checks.findByOperation(input.operationId)
      if (replay) {
        if (replay.applicationId !== application.id) {
          return yield* new RegistryConflictError({
            message:
              'The operation id is already used by another listing check.',
          })
        }
        return yield* loadCheckResult(
          application.id,
          replay,
          true,
          application.applicationStatus
        )
      }

      const recordedAt = yield* registryNow
      yield* checks.ensureSchedule(application.id, recordedAt, recordedAt)
      const observation = input.observation
      const decision = decideListingCheck(
        application,
        { ...observation, checkedAt: recordedAt },
        input.mode
      )
      const persisted: ApplicationListingCheck = {
        ...observation,
        applicationId: application.id,
        id: newRegistryId(),
        nextCheckAt: decision.nextCheckAt,
        operationId: input.operationId,
        receivedAt: recordedAt,
        recommendedAction: decision.action,
        runId: input.runId ?? null,
      }
      const applied = yield* checks.persist({
        ...persisted,
        archiveApplication: decision.archiveApplication,
        closedCandidateAt: decision.closedCandidateAt,
        consecutiveClosedChecks: decision.consecutiveClosedChecks,
        eventId: decision.archiveApplication ? newRegistryId() : null,
        listingAvailability: decision.availability,
        recordedAt,
      })
      if (!applied) {
        return yield* new RegistryConflictError({
          message: 'The application disappeared while it was being checked.',
        })
      }
      return yield* loadCheckResult(
        application.id,
        persisted,
        false,
        application.applicationStatus
      )
    })

  const checkApplication = (
    application: Application,
    input: Omit<RecordListingObservationInput, 'observation'>
  ) =>
    observe(application).pipe(
      Effect.flatMap((observation) =>
        recordObservation(application, { ...input, observation })
      )
    )

  const runCounts = (
    rows: readonly ApplicationListingCheck[],
    expectedCount: number,
    completed: boolean
  ): ListingCheckRunCounts => {
    const outcomes = countBy(rows, ({ outcome }) => outcome)
    return {
      checkedCount: rows.length,
      closedCount: outcomes.closed ?? 0,
      errorCount: completed ? Math.max(0, expectedCount - rows.length) : 0,
      openCount: outcomes.open ?? 0,
      reviewCount: outcomes.unknown ?? 0,
      selectedCount: expectedCount,
    }
  }

  return {
    findRun: Effect.fn('ListingChecksService.findRun')((runId: string) =>
      checks.findRun(runId).pipe(
        Effect.flatMap((run) =>
          run
            ? Effect.succeed(run)
            : Effect.fail(
                new RegistryNotFoundError({
                  identifier: runId,
                  message: `Listing check run not found: ${runId}`,
                })
              )
        )
      )
    ),
    listByApplication: Effect.fn('ListingChecksService.listByApplication')(
      (identifier: string) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          return { items: yield* checks.listByApplication(application.id) }
        })
    ),
    runDue: Effect.fn('ListingChecksService.runDue')(
      (input: RunDueListingChecksInput) =>
        Effect.gen(function* () {
          const startedAt = yield* registryNow
          const runId = newRegistryId()
          yield* checks.startRun({
            id: runId,
            mode: input.mode,
            selectedCount: 0,
            startedAt,
            trigger: 'scheduled',
          })
          yield* checks.ensureEligibleSchedules(startedAt)
          const schedules = yield* checks.claimDue({
            leaseToken: runId,
            leaseUntil: addMinutes(startedAt, 20),
            limit: input.limit,
            now: startedAt,
          })
          const results = yield* Effect.forEach(
            schedules,
            (schedule) =>
              findRequiredApplication(
                applications,
                schedule.applicationId
              ).pipe(
                Effect.flatMap((application) =>
                  checkApplication(application, {
                    mode: input.mode,
                    operationId: `${runId}:${application.id}`,
                    runId,
                  })
                ),
                Effect.matchEffect({
                  onFailure: (error) =>
                    registryNow.pipe(
                      Effect.flatMap((failedAt) =>
                        checks.failClaim({
                          applicationId: schedule.applicationId,
                          error: error.message,
                          leaseToken: runId,
                          nextAttemptAt: addMinutes(
                            failedAt,
                            retryDelayMinutes(schedule.attemptCount)
                          ),
                          now: failedAt,
                        })
                      ),
                      Effect.as(null)
                    ),
                  onSuccess: Effect.succeed,
                })
              ),
            { concurrency: 5 }
          )
          const [successful, failed] = partition(
            results,
            (result): result is CheckListingResult => result !== null
          )
          const availability = countBy(
            successful,
            ({ application }) => application.listingAvailability
          )
          const counts: ListingCheckRunCounts = {
            checkedCount: successful.length,
            closedCount: availability.closed ?? 0,
            errorCount: failed.length,
            openCount: availability.open ?? 0,
            reviewCount:
              (availability.unknown ?? 0) +
              (availability.suspected_closed ?? 0),
            selectedCount: schedules.length,
          }
          const completedAt = yield* registryNow
          yield* checks.completeRun(runId, counts, completedAt)
          const run = yield* checks.findRun(runId)
          if (!run) {
            return yield* new RegistryNotFoundError({
              identifier: runId,
              message: `Listing check run disappeared: ${runId}`,
            })
          }
          return { checks: successful.map(({ check }) => check), run }
        })
    ),
    submitFindings: Effect.fn('ListingChecksService.submitFindings')(
      (input: SubmitListingCheckFindingsInput) =>
        Effect.gen(function* () {
          yield* checks.startRun({
            id: input.runId,
            mode: input.mode,
            selectedCount: input.expectedCount,
            startedAt: input.startedAt,
            trigger: 'cli',
          })
          const existingRun = yield* checks.findRun(input.runId)
          if (
            !existingRun ||
            existingRun.mode !== input.mode ||
            existingRun.trigger !== 'cli' ||
            existingRun.startedAt !== input.startedAt ||
            existingRun.selectedCount !== input.expectedCount
          ) {
            return yield* new RegistryConflictError({
              message: `Listing check import ${input.runId} conflicts with an existing run.`,
            })
          }

          const submissions = yield* Effect.forEach(
            input.findings,
            (finding) =>
              Effect.gen(function* () {
                const application = yield* findRequiredApplication(
                  applications,
                  finding.applicationId
                )
                const captureItems = yield* captures.listByApplication(
                  application.id
                )
                const expectedUrl =
                  captureItems.at(-1)?.applicationUrl ??
                  application.canonicalUrl
                if (
                  application.canonicalUrl !== finding.canonicalUrl ||
                  application.company !== finding.target.company ||
                  application.role !== finding.target.role ||
                  (expectedUrl !== finding.target.url &&
                    application.canonicalUrl !== finding.target.url) ||
                  finding.observation.requestedUrl !== finding.target.url
                ) {
                  return yield* new RegistryConflictError({
                    message: `Application ${finding.applicationId} changed after the local scan started.`,
                  })
                }
                return yield* recordObservation(application, {
                  mode: input.mode,
                  observation: finding.observation,
                  operationId: finding.operationId,
                  runId: input.runId,
                })
              }).pipe(
                Effect.matchEffect({
                  onFailure: (error) =>
                    error._tag === 'RegistryDatabaseError'
                      ? Effect.fail(error)
                      : Effect.succeed({
                          _tag: 'Rejected' as const,
                          applicationId: finding.applicationId,
                          message: error.message,
                        }),
                  onSuccess: (result) =>
                    Effect.succeed({
                      _tag: 'Accepted' as const,
                      result,
                    }),
                })
              ),
            { concurrency: 1 }
          )

          const accepted = submissions.flatMap((submission) =>
            submission._tag === 'Accepted' ? [submission.result] : []
          )
          const rejected = submissions.flatMap((submission) =>
            submission._tag === 'Rejected'
              ? [
                  {
                    applicationId: submission.applicationId,
                    message: submission.message,
                  },
                ]
              : []
          )
          const allChecks = yield* checks.listByRun(input.runId)
          const runBeforeUpdate = yield* checks.findRun(input.runId)
          if (!runBeforeUpdate) {
            return yield* new RegistryNotFoundError({
              identifier: input.runId,
              message: `Listing check run disappeared: ${input.runId}`,
            })
          }
          const completed =
            input.finalBatch || runBeforeUpdate.state === 'completed'
          const counts = runCounts(allChecks, input.expectedCount, completed)
          if (input.finalBatch && runBeforeUpdate.state !== 'completed') {
            yield* checks.completeRun(input.runId, counts, yield* registryNow)
          } else {
            yield* checks.updateRunCounts(input.runId, counts)
          }
          const run = yield* checks.findRun(input.runId)
          if (!run) {
            return yield* new RegistryNotFoundError({
              identifier: input.runId,
              message: `Listing check run disappeared: ${input.runId}`,
            })
          }
          return {
            archivedCount: sumBy(accepted, ({ archived }) => Number(archived)),
            checks: accepted.map(({ check }) => check),
            rejected,
            replayedCount: sumBy(accepted, ({ replayed }) => Number(replayed)),
            run,
          }
        })
    ),
  } satisfies ListingChecksServiceShape
})

export const ListingChecksServiceLive = Layer.effect(ListingChecksService, make)
