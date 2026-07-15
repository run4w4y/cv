import type {
  ApplicationListItem,
  SubmitListingCheckFindingsRequest,
} from '@cv/application-registry-api-contract'
import type {
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'
import { ListingAvailabilityChecker } from '@cv/application-registry-listing-check'
import {
  Console,
  Crypto,
  DateTime,
  Effect,
  Ref,
  Schedule,
  Schema,
  Semaphore,
} from 'effect'
import { chunk, countBy, sumBy } from 'es-toolkit'

import { ApplicationRegistryClient } from '../client'

const PositiveIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThan(0))
)

export const ListingScanOptionsSchema = Schema.Struct({
  archive: Schema.Boolean,
  batchSize: Schema.Int.pipe(
    Schema.check(Schema.isBetween({ minimum: 1, maximum: 50 }))
  ),
  concurrency: PositiveIntegerSchema,
  dryRun: Schema.Boolean,
  perHost: PositiveIntegerSchema,
})

export type ListingScanOptions = Schema.Schema.Type<
  typeof ListingScanOptionsSchema
>

export type ListingScanSummary = {
  readonly archived: number
  readonly checked: number
  readonly closed: number
  readonly dryRun: boolean
  readonly open: number
  readonly queuedBatches: number
  readonly rejected: number
  readonly runId: string
  readonly submittedBatches: number
  readonly total: number
  readonly unknown: number
}

const mergeEvidence = (
  preferred: ListingObservation,
  canonical: ListingObservation
): ListingObservation => ({
  ...preferred,
  evidence: [...preferred.evidence, ...canonical.evidence],
})

const targetFor = (application: ApplicationListItem): ListingCheckTarget => ({
  company: application.company,
  role: application.role,
  url: application.latestCapture?.applicationUrl ?? application.canonicalUrl,
})

const retryable = (observation: ListingObservation) =>
  observation.reasonCode === 'network_error' ||
  observation.reasonCode === 'rate_limited' ||
  observation.reasonCode === 'server_error'

const transientObservationSchedule = Schedule.exponential('400 millis').pipe(
  Schedule.jittered,
  Schedule.take(2)
)

const hostnameFor = (url: string) =>
  URL.canParse(url) ? new URL(url).hostname : url

const checkWithRetry = (
  checker: ListingAvailabilityChecker,
  target: ListingCheckTarget,
  hostSemaphores: ReadonlyMap<string, Semaphore.Semaphore>
) => {
  const check = checker.check(target)
  const semaphore = hostSemaphores.get(hostnameFor(target.url))
  return (semaphore ? semaphore.withPermit(check) : check).pipe(
    Effect.repeat({
      schedule: transientObservationSchedule,
      while: retryable,
    })
  )
}

const checkApplication = (
  checker: ListingAvailabilityChecker,
  application: ApplicationListItem,
  hostSemaphores: ReadonlyMap<string, Semaphore.Semaphore>
) =>
  Effect.gen(function* () {
    const target = targetFor(application)
    const preferred = yield* checkWithRetry(checker, target, hostSemaphores)
    if (
      preferred.outcome !== 'unknown' ||
      target.url === application.canonicalUrl
    ) {
      return { observation: preferred, target }
    }
    const canonicalTarget = { ...target, url: application.canonicalUrl }
    const canonical = yield* checkWithRetry(
      checker,
      canonicalTarget,
      hostSemaphores
    )
    return canonical.outcome === 'open'
      ? { observation: canonical, target: canonicalTarget }
      : {
          observation: mergeEvidence(preferred, canonical),
          target,
        }
  })

const loadAllApplications = Effect.gen(function* () {
  const client = yield* ApplicationRegistryClient
  const byId = new Map<string, ApplicationListItem>()
  let after: string | undefined
  const seenCursors = new Set<string>()

  for (;;) {
    const page = yield* client.list({ pagination: { after, size: 100 } })
    for (const application of page.items) byId.set(application.id, application)
    if (!page.pageInfo.nextCursor) break
    if (seenCursors.has(page.pageInfo.nextCursor)) {
      return yield* Effect.fail(
        new Error(
          `Application pagination repeated cursor ${page.pageInfo.nextCursor}.`
        )
      )
    }
    seenCursors.add(page.pageInfo.nextCursor)
    after = page.pageInfo.nextCursor
  }
  return [...byId.values()]
})

export const runLocalListingScan = (input: ListingScanOptions) =>
  Effect.gen(function* () {
    const options = yield* Schema.decodeUnknownEffect(ListingScanOptionsSchema)(
      input
    )

    const client = yield* ApplicationRegistryClient
    const checker = yield* ListingAvailabilityChecker
    const crypto = yield* Crypto.Crypto
    const runId = yield* crypto.randomUUIDv7
    const startedAt = DateTime.formatIso(yield* DateTime.now)
    const applications = yield* loadAllApplications
    yield* Console.error(
      `Loaded ${applications.length} applications; checking locally with concurrency ${options.concurrency} (per host ${options.perHost}).`
    )

    const hostnames = new Set(
      applications.flatMap((application) => [
        hostnameFor(targetFor(application).url),
        hostnameFor(application.canonicalUrl),
      ])
    )
    const hostSemaphores = new Map<string, Semaphore.Semaphore>()
    for (const hostname of hostnames) {
      hostSemaphores.set(hostname, yield* Semaphore.make(options.perHost))
    }
    const completed = yield* Ref.make(0)
    const scanApplication = Effect.fn('ListingScan.scanApplication')(function* (
      application: ApplicationListItem
    ) {
      const { observation, target } = yield* checkApplication(
        checker,
        application,
        hostSemaphores
      )
      const count = yield* Ref.updateAndGet(completed, (value) => value + 1)
      if (count % 25 === 0 || count === applications.length) {
        yield* Console.error(
          `Checked ${count}/${applications.length} applications.`
        )
      }
      return {
        applicationId: application.id,
        canonicalUrl: application.canonicalUrl,
        observation,
        operationId: `${runId}:${application.id}`,
        target,
      }
    })
    const findings = yield* Effect.forEach(applications, scanApplication, {
      concurrency: options.concurrency,
    })

    const outcomes = countBy(findings, ({ observation }) => observation.outcome)
    const outcomeCounts = {
      closed: outcomes.closed ?? 0,
      open: outcomes.open ?? 0,
      unknown: outcomes.unknown ?? 0,
    }
    if (options.dryRun) {
      return {
        archived: 0,
        checked: findings.length,
        dryRun: true,
        queuedBatches: 0,
        rejected: 0,
        runId,
        submittedBatches: 0,
        total: applications.length,
        ...outcomeCounts,
      } satisfies ListingScanSummary
    }

    const batches =
      findings.length === 0 ? [[]] : chunk(findings, options.batchSize)
    const uploads = yield* Effect.forEach(
      batches,
      (batch, index) => {
        const batchId = `${runId}-batch-${index + 1}`
        const request: SubmitListingCheckFindingsRequest = {
          expectedCount: findings.length,
          finalBatch: index === batches.length - 1,
          findings: batch,
          mode: options.archive ? 'archive_eligible' : 'report',
          runId,
          startedAt,
        }
        return client.submitListingCheckFindings(batchId, request)
      },
      { concurrency: 4 }
    )
    const uploadStatuses = countBy(uploads, ({ status }) => status)
    return {
      archived: sumBy(uploads, (result) =>
        result.status === 'synced' ? result.response.archivedCount : 0
      ),
      checked: findings.length,
      dryRun: false,
      queuedBatches: uploadStatuses.queued ?? 0,
      rejected: sumBy(uploads, (result) =>
        result.status === 'synced' ? result.response.rejected.length : 0
      ),
      runId,
      submittedBatches: uploadStatuses.synced ?? 0,
      total: applications.length,
      ...outcomeCounts,
    } satisfies ListingScanSummary
  })
