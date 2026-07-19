import { describe, expect, test } from 'bun:test'
import type {
  ApplicationListItem,
  SubmitListingCheckFindingsRequest,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ListingObservation,
} from '@cv/application-registry-entity'
import { ListingAvailabilityChecker } from '@cv/application-registry-listing-check'
import { BunServices } from '@effect/platform-bun'
import { Duration, Effect, Layer, Option, Schema } from 'effect'

import {
  ApplicationRegistryClient,
  type ApplicationRegistryClientService,
} from '../client'
import { ListingScanOptionsSchema, runLocalListingScan } from './listing-scan'

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  canonicalUrl: 'https://host0.example/jobs/one',
  company: 'Example',
  createdAt: '2026-07-10T00:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  jobKey: 'web:one',
  lastContactAt: null,
  listingAvailability: 'unchecked',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  role: 'Engineer',
  source: 'web',
  sourceJobId: null,
  targetStage: 'backlog',
  updatedAt: '2026-07-10T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const applications: readonly ApplicationListItem[] = Array.from(
  { length: 20 },
  (_, index) => ({
    ...application,
    annualCompensation: null,
    canonicalUrl: `https://host${index % 4}.example/jobs/${index}`,
    counts: { notes: 0 },
    identityAliases: [],
    id: `application-${index}`,
    jobKey: `web:${index}`,
    labels: [],
    latestEvent: null,
    updatedRevision: index + 1,
  })
)

const observationFor = (
  url: string,
  overrides: Partial<ListingObservation> = {}
): ListingObservation => ({
  checkedAt: '2026-07-13T00:00:00.000Z',
  checkerVersion: 'test',
  confidence: 'high',
  contentHash: null,
  evidence: [
    {
      code: 'test',
      detail: 'Test listing observation.',
      sourceUrl: url,
    },
  ],
  finalUrl: url,
  httpStatus: 200,
  outcome: 'open',
  provider: new URL(url).hostname,
  reasonCode: 'provider_open',
  requestedUrl: url,
  ...overrides,
})

describe('local listing scan', () => {
  test('validates scan limits through the shared options schema', () => {
    const valid = {
      archive: false,
      batchSize: 50,
      concurrency: 64,
      dryRun: true,
      perHost: 6,
    }

    expect(
      Option.isSome(Schema.decodeUnknownOption(ListingScanOptionsSchema)(valid))
    ).toBe(true)
    for (const invalid of [
      { ...valid, batchSize: 51 },
      { ...valid, concurrency: 0 },
      { ...valid, perHost: 0 },
    ]) {
      expect(
        Option.isNone(
          Schema.decodeUnknownOption(ListingScanOptionsSchema)(invalid)
        )
      ).toBe(true)
    }
  })

  test('checks every application locally while enforcing global and per-host concurrency', async () => {
    let active = 0
    let maximumActive = 0
    const activeByHost = new Map<string, number>()
    const maximumByHost = new Map<string, number>()
    const checker = Layer.succeed(ListingAvailabilityChecker, {
      check: (target) => {
        const host = new URL(target.url).hostname
        const observation = observationFor(target.url, {
          evidence: [
            {
              code: 'test',
              detail: 'The canonical posting is open.',
              sourceUrl: target.url,
            },
          ],
        })
        return Effect.sync(() => {
          active += 1
          maximumActive = Math.max(maximumActive, active)
          const hostActive = (activeByHost.get(host) ?? 0) + 1
          activeByHost.set(host, hostActive)
          maximumByHost.set(
            host,
            Math.max(maximumByHost.get(host) ?? 0, hostActive)
          )
        }).pipe(
          Effect.andThen(Effect.sleep(Duration.millis(10))),
          Effect.as(observation),
          Effect.ensuring(
            Effect.sync(() => {
              active -= 1
              activeByHost.set(host, (activeByHost.get(host) ?? 1) - 1)
            })
          )
        )
      },
    })
    const client = Layer.succeed(ApplicationRegistryClient, {
      list: () =>
        Effect.succeed({
          items: applications,
          pageInfo: {
            kind: 'cursor',
            size: 50,
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
          },
        }),
    } as unknown as ApplicationRegistryClientService)

    const summary = await Effect.runPromise(
      runLocalListingScan({
        archive: false,
        batchSize: 10,
        concurrency: 5,
        dryRun: true,
        perHost: 2,
      }).pipe(
        Effect.provide(Layer.merge(client, checker)),
        Effect.provide(BunServices.layer)
      )
    )

    expect(summary.checked).toBe(20)
    expect(summary.open).toBe(20)
    expect(maximumActive).toBeGreaterThan(2)
    expect(maximumActive).toBeLessThanOrEqual(5)
    expect(Math.max(...maximumByHost.values())).toBeLessThanOrEqual(2)
  })

  test('repeats transient observations until the listing opens', async () => {
    const retryApplication = applications.at(0)
    if (!retryApplication) throw new Error('Expected a listing scan fixture.')
    let attempts = 0
    const checker = Layer.succeed(ListingAvailabilityChecker, {
      check: (target) =>
        Effect.sync(() => {
          attempts += 1
          return observationFor(
            target.url,
            attempts === 1
              ? {
                  confidence: 'low',
                  outcome: 'unknown',
                  reasonCode: 'rate_limited',
                }
              : {}
          )
        }),
    })
    const client = Layer.succeed(ApplicationRegistryClient, {
      list: () =>
        Effect.succeed({
          items: [retryApplication],
          pageInfo: {
            kind: 'cursor',
            size: 50,
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
          },
        }),
    } as unknown as ApplicationRegistryClientService)

    const summary = await Effect.runPromise(
      runLocalListingScan({
        archive: false,
        batchSize: 10,
        concurrency: 1,
        dryRun: true,
        perHost: 1,
      }).pipe(
        Effect.provide(Layer.merge(client, checker)),
        Effect.provide(BunServices.layer)
      )
    )

    expect(attempts).toBe(2)
    expect(summary.open).toBe(1)
    expect(summary.unknown).toBe(0)
  })

  test('submits a final empty batch when there are no applications', async () => {
    let submittedBatchId = ''
    let submittedRequest: SubmitListingCheckFindingsRequest | undefined
    const checker = Layer.succeed(ListingAvailabilityChecker, {
      check: () => Effect.die('The empty scan must not invoke the checker.'),
    })
    const client = Layer.succeed(ApplicationRegistryClient, {
      list: () =>
        Effect.succeed({
          items: [],
          pageInfo: {
            kind: 'cursor',
            size: 50,
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
          },
        }),
      submitListingCheckFindings: (
        batchId: string,
        request: SubmitListingCheckFindingsRequest
      ) =>
        Effect.sync(() => {
          submittedBatchId = batchId
          submittedRequest = request
          return {
            disposition: 'retry' as const,
            failure: 'offline',
            operationId: batchId,
            status: 'queued' as const,
          }
        }),
    } as unknown as ApplicationRegistryClientService)

    const summary = await Effect.runPromise(
      runLocalListingScan({
        archive: false,
        batchSize: 10,
        concurrency: 1,
        dryRun: false,
        perHost: 1,
      }).pipe(
        Effect.provide(Layer.merge(client, checker)),
        Effect.provide(BunServices.layer)
      )
    )

    expect(submittedBatchId).toBe(`${summary.runId}-batch-1`)
    expect(submittedRequest).toMatchObject({
      expectedCount: 0,
      finalBatch: true,
      findings: [],
    })
    expect(summary.checked).toBe(0)
    expect(summary.queuedBatches).toBe(1)
  })
})
