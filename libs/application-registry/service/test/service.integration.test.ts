import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import type { D1Database } from '@cloudflare/workers-types'
import { makeInMemoryArtifactStoreLayer } from '@cv/application-registry-artifact-store/test-support'
import { makeRegistryCrudLive } from '@cv/application-registry-crud/live'
import { RegistryMiniflareHarness } from '@cv/application-registry-crud/test-support'
import { FxRates } from '@cv/application-registry-fx'
import { ListingAvailabilityChecker } from '@cv/application-registry-listing-check'
import { Duration, Effect, Layer, ManagedRuntime, Result } from 'effect'

import {
  ApplicationsService,
  FactsReleasesService,
  type ListApplicationsInput,
  ListingChecksService,
  OpaqueObjectsService,
} from '../src'
import { RegistryServicesLive } from '../src/live'
import { makeApplicationInput, recordedAt } from './support/inputs'
import {
  concurrentCapturesWorkflow,
  concurrentNoteWorkflow,
  concurrentUpsertsWorkflow,
  lifecycleRaceWorkflow,
  optimisticPatchRaceWorkflow,
} from './workflows/concurrency'
import {
  applicationWorkflow,
  captureMergeWorkflow,
  compensationWorkflow,
  defaultsWorkflow,
  eventWorkflow,
  noteAndCaptureWorkflow,
  patchNullabilityWorkflow,
} from './workflows/core'
import { rollbackWorkflow } from './workflows/persistence'

const FakeFxRatesLive = Layer.succeed(FxRates, {
  get: (baseCurrency, quoteCurrency) =>
    Effect.succeed({
      baseCurrency,
      fetchedAt: recordedAt,
      observedAt: recordedAt,
      provider: 'service-integration',
      quoteCurrency,
      rate: 2,
    }),
})

const FakeListingAvailabilityCheckerLive = Layer.succeed(
  ListingAvailabilityChecker,
  {
    check: (target) =>
      Effect.succeed({
        checkedAt: recordedAt,
        checkerVersion: 'test',
        confidence: 'high',
        contentHash: null,
        evidence: [
          {
            code: 'test_open',
            detail: 'Integration test listing is open.',
            sourceUrl: target.url,
          },
        ],
        finalUrl: target.url,
        httpStatus: 200,
        outcome: 'open',
        provider: 'test',
        reasonCode: 'provider_open',
        requestedUrl: target.url,
      }),
  }
)

const makeRegistryServiceTestRuntime = (database: D1Database) =>
  ManagedRuntime.make(
    RegistryServicesLive.pipe(
      Layer.provide(makeRegistryCrudLive(Effect.succeed(database))),
      Layer.provide(makeInMemoryArtifactStoreLayer()),
      Layer.provide(FakeFxRatesLive),
      Layer.provide(FakeListingAvailabilityCheckerLive)
    )
  )

let harness: RegistryMiniflareHarness
let runtime: ReturnType<typeof makeRegistryServiceTestRuntime>

beforeEach(async () => {
  harness = await RegistryMiniflareHarness.make({
    databaseBinding: 'APPLICATION_REGISTRY_DB',
  })
  runtime = makeRegistryServiceTestRuntime(harness.database)
})

afterEach(async () => {
  await runtime.dispose()
  await harness.dispose()
})

test('runs application defaults, patches, labels, and revision filters over D1', async () => {
  const result = await runtime.runPromise(applicationWorkflow)

  assert.equal(result.created.applicationStatus, 'not_started')
  assert.equal(result.created.version, 1)
  assert.deepEqual(result.deltaIds, [result.created.id])
  assert.deepEqual(result.labels, ['priority', 'remote'])
  assert.deepEqual(result.storedLabels, result.labels)
  assert.equal(result.patched.personalPriority, 'high')
  assert.equal(result.patched.version, 2)
})

test('publishes and resolves an immutable facts release over D1 and opaque storage', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const objects = yield* OpaqueObjectsService
      const facts = yield* FactsReleasesService
      const manifestBytes = new TextEncoder().encode('{"manifest":true}')
      const catalogBytes = new TextEncoder().encode('{"facts":[]}')
      const assetBytes = new Uint8Array([1, 3, 5, 7])
      const [manifest, catalog, asset] = yield* Effect.all([
        objects.put(manifestBytes),
        objects.put(catalogBytes),
        objects.put(assetBytes),
      ])
      const releaseId = `facts-${manifest.sha256}`
      const registration = {
        assets: [
          {
            assetId: 'portrait',
            byteLength: asset.byteLength,
            fileName: 'portrait.webp',
            mediaType: 'image/webp',
            objectKey: asset.key,
            releaseId,
            sha256: asset.sha256,
          },
        ],
        catalogs: [
          {
            byteLength: catalog.byteLength,
            locale: 'en',
            mediaType: 'application/json',
            objectKey: catalog.key,
            releaseId,
            sha256: catalog.sha256,
          },
        ],
        release: {
          compilerCommit: 'compiler-commit',
          compilerRepository: 'https://example.test/cv',
          createdAt: recordedAt,
          factsSchemaVersion: '@cv/contracts/facts@1',
          id: releaseId,
          manifestByteLength: manifest.byteLength,
          manifestObjectKey: manifest.key,
          manifestSha256: manifest.sha256,
          sourceCommit: 'facts-commit',
          sourceRepository: 'https://example.test/cv-content',
        },
      }

      const stored = yield* facts.register(registration)
      const replayed = yield* facts.register(registration)
      const channel = yield* facts.activate('stable', releaseId, 0)
      const active = yield* facts.readActive('stable', 'en')
      const stale = yield* Effect.result(facts.activate('stable', releaseId, 0))
      return {
        active,
        assetBytes,
        catalogBytes,
        channel,
        replayed,
        stale,
        stored,
      }
    })
  )

  assert.deepEqual(result.replayed, result.stored)
  assert.equal(result.channel.version, 1)
  assert.equal(result.active.release.id, result.stored.release.id)
  assert.deepEqual(result.active.catalogBytes, result.catalogBytes)
  assert.deepEqual(result.active.assetContents[0]?.bytes, result.assetBytes)
  assert.equal(Result.isFailure(result.stale), true)
  if (Result.isFailure(result.stale)) {
    assert.equal(result.stale.failure._tag, 'RegistryConflictError')
  }
})

test('continues an explicit revision filter through query cursors', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const baseline = yield* applications.upsert(
        makeApplicationInput('revision-page-baseline')
      )
      const revisionFilter = [
        {
          type: 'condition',
          field: 'updatedRevision',
          operator: 'gt',
          value: baseline.updatedRevision,
        },
      ] satisfies NonNullable<ListApplicationsInput['filters']>

      const firstDelta = yield* applications.upsert(
        makeApplicationInput('revision-page-first')
      )
      const secondDelta = yield* applications.upsert(
        makeApplicationInput('revision-page-second')
      )
      const first = yield* applications.list({
        filters: revisionFilter,
        pagination: { size: 1 },
      })
      const nextCursor = first.pageInfo.nextCursor
      if (nextCursor === null) {
        return yield* Effect.die('Expected an opaque continuation cursor.')
      }
      const second = yield* applications.list({
        filters: revisionFilter,
        pagination: { after: nextCursor, size: 1 },
      })
      const changedFilter = yield* applications.list({
        filters: [
          ...revisionFilter,
          {
            type: 'condition',
            field: 'company',
            operator: 'contains',
            value: 'A company that does not exist',
          },
        ],
        pagination: { size: 1 },
      })

      return {
        baseline,
        changedFilter,
        first,
        firstDelta,
        second,
        secondDelta,
      }
    })
  )

  assert.deepEqual(result.changedFilter.items, [])
  assert.deepEqual(
    [...result.first.items, ...result.second.items].map(({ id }) => id),
    [result.firstDelta.id, result.secondDelta.id]
  )
  assert.equal(result.second.pageInfo.nextCursor, null)
})

test('rejects application cursors after filter or token tampering', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      yield* applications.upsert(makeApplicationInput('cursor-first'))
      yield* applications.upsert(makeApplicationInput('cursor-second'))

      const first = yield* applications.list({
        filters: [
          {
            type: 'condition',
            field: 'company',
            operator: 'contains',
            value: 'Service Integration',
          },
        ],
        pagination: { size: 1 },
      })
      if (first.pageInfo.nextCursor === null) {
        return yield* Effect.die('Expected a second application page.')
      }

      const changedFilter = yield* Effect.result(
        applications.list({
          filters: [
            {
              type: 'condition',
              field: 'company',
              operator: 'contains',
              value: 'Another Company',
            },
          ],
          pagination: { after: first.pageInfo.nextCursor, size: 1 },
        })
      )
      const cursor = first.pageInfo.nextCursor
      const tampered = `${cursor.startsWith('A') ? 'B' : 'A'}${cursor.slice(1)}`
      const changedCursor = yield* Effect.result(
        applications.list({
          filters: [
            {
              type: 'condition',
              field: 'company',
              operator: 'contains',
              value: 'Service Integration',
            },
          ],
          pagination: { after: tampered, size: 1 },
        })
      )

      return { changedCursor, changedFilter }
    })
  )

  assert.equal(
    Result.isFailure(result.changedFilter)
      ? result.changedFilter.failure._tag
      : null,
    'RegistryBadRequestError'
  )
  assert.equal(
    Result.isFailure(result.changedCursor)
      ? result.changedCursor.failure._tag
      : null,
    'RegistryBadRequestError'
  )
})

test('creates without replacement, searches identity fields, patches metadata, and deletes optimistically', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const input = {
        ...makeApplicationInput('operator-crud'),
        sourceJobId: 'searchable-source-id-42',
      }
      const created = yield* applications.create(input)
      const duplicate = yield* Effect.result(applications.create(input))
      const search = yield* applications.list({
        filters: [
          {
            type: 'condition',
            field: 'q',
            operator: 'matches',
            value: 'source-id-42',
          },
        ],
        pagination: { size: 10 },
      })
      const patched = yield* applications.patch(created.id, {
        canonicalUrl: 'https://example.test/jobs/operator-crud-updated',
        company: 'Updated Operator Company',
        expectedVersion: created.version,
        location: 'Tokyo',
        role: 'Staff Effect Engineer',
        source: 'official-careers',
        sourceJobId: 'updated-source-id',
      })
      const staleDelete = yield* Effect.result(
        applications.remove(created.id, created.version)
      )
      yield* applications.remove(created.id, patched.version)
      const removed = yield* Effect.result(applications.find(created.id))
      return { created, duplicate, patched, removed, search, staleDelete }
    })
  )

  assert.equal(result.created.version, 1)
  assert.equal(
    Result.isFailure(result.duplicate) ? result.duplicate.failure._tag : null,
    'RegistryConflictError'
  )
  assert.deepEqual(
    result.search.items.map(({ id }) => id),
    [result.created.id]
  )
  assert.equal(result.patched.company, 'Updated Operator Company')
  assert.equal(result.patched.role, 'Staff Effect Engineer')
  assert.equal(result.patched.source, 'official-careers')
  assert.equal(result.patched.location, 'Tokyo')
  assert.equal(
    Result.isFailure(result.staleDelete)
      ? result.staleDelete.failure._tag
      : null,
    'RegistryConflictError'
  )
  assert.equal(
    Result.isFailure(result.removed) ? result.removed.failure._tag : null,
    'RegistryNotFoundError'
  )
})

test('persists an explicit status transition and replays its event command', async () => {
  const result = await runtime.runPromise(eventWorkflow)

  assert.equal(result.applicationStatus, 'technical_screen')
  assert.equal(result.applicationVersion, 2)
  assert.equal(result.firstReplayed, false)
  assert.equal(result.replayed, true)
  assert.equal(result.eventIdsMatch, true)
  assert.equal(result.conflictTag, 'RegistryConflictError')
  assert.deepEqual(result.storedEventOperationIds, ['service:event:1'])

  const receipts = await harness.query<{ operationId: string }>(
    `select operation_id as operationId
       from command_receipts
      where operation_id = ?1`,
    ['service:event:1']
  )
  assert.deepEqual(receipts, [{ operationId: 'service:event:1' }])
})

test('ingests local findings idempotently and applies archival policy on the backend', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const listingChecks = yield* ListingChecksService
      const application = yield* applications.upsert(
        makeApplicationInput('local-finding')
      )
      const input = {
        expectedCount: 1,
        finalBatch: true,
        findings: [
          {
            applicationId: application.id,
            canonicalUrl: application.canonicalUrl,
            observation: {
              checkedAt: recordedAt,
              checkerVersion: 'test-local',
              confidence: 'confirmed' as const,
              contentHash: null,
              evidence: [
                {
                  code: 'provider_api',
                  detail: 'Provider confirms the posting is closed.',
                  sourceUrl: application.canonicalUrl,
                },
              ],
              finalUrl: application.canonicalUrl,
              httpStatus: 410,
              outcome: 'closed' as const,
              provider: 'test-provider',
              reasonCode: 'provider_closed' as const,
              requestedUrl: application.canonicalUrl,
            },
            operationId: 'local-run:application:1',
            target: {
              company: application.company,
              role: application.role,
              url: application.canonicalUrl,
            },
          },
        ],
        mode: 'archive_eligible' as const,
        runId: 'local-run',
        startedAt: recordedAt,
      }
      const first = yield* listingChecks.submitFindings(input)
      const replay = yield* listingChecks.submitFindings(input)
      return { first, replay }
    })
  )

  assert.equal(result.first.archivedCount, 1)
  assert.equal(result.first.run.state, 'completed')
  assert.equal(result.first.run.checkedCount, 1)
  assert.equal(result.replay.replayedCount, 1)
  assert.equal(result.replay.run.checkedCount, 1)
  assert.deepEqual(result.replay.rejected, [])
})

test('manually resolves suspected listings as open or closed with an audit check', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const listingChecks = yield* ListingChecksService
      const openCandidate = yield* applications.upsert(
        makeApplicationInput('manual-open-review')
      )
      const closedCandidate = yield* applications.upsert(
        makeApplicationInput('manual-closed-review')
      )

      const makeSuspected = (
        application: typeof openCandidate,
        runId: string
      ) =>
        listingChecks.submitFindings({
          expectedCount: 1,
          finalBatch: true,
          findings: [
            {
              applicationId: application.id,
              canonicalUrl: application.canonicalUrl,
              observation: {
                checkedAt: recordedAt,
                checkerVersion: 'test-local',
                confidence: 'medium',
                contentHash: null,
                evidence: [
                  {
                    code: 'closed_copy',
                    detail: 'The page says applications are closed.',
                    sourceUrl: application.canonicalUrl,
                  },
                ],
                finalUrl: application.canonicalUrl,
                httpStatus: 200,
                outcome: 'closed',
                provider: 'test-provider',
                reasonCode: 'explicit_closed_text',
                requestedUrl: application.canonicalUrl,
              },
              operationId: `${runId}:finding`,
              target: {
                company: application.company,
                role: application.role,
                url: application.canonicalUrl,
              },
            },
          ],
          mode: 'report',
          runId,
          startedAt: recordedAt,
        })

      yield* makeSuspected(openCandidate, 'manual-open-candidate')
      yield* makeSuspected(closedCandidate, 'manual-closed-candidate')
      const suspectedOpen = yield* applications.find(openCandidate.id)
      const suspectedClosed = yield* applications.find(closedCandidate.id)

      const opened = yield* listingChecks.resolveAvailability(
        suspectedOpen.id,
        {
          expectedVersion: suspectedOpen.version,
          operationId: 'manual-review:open',
          resolution: 'open',
        }
      )
      const closeInput = {
        expectedVersion: suspectedClosed.version,
        operationId: 'manual-review:closed',
        resolution: 'closed' as const,
      }
      const closed = yield* listingChecks.resolveAvailability(
        suspectedClosed.id,
        closeInput
      )
      const replayed = yield* listingChecks.resolveAvailability(
        suspectedClosed.id,
        closeInput
      )
      const conflictingReplay = yield* listingChecks
        .resolveAvailability(suspectedClosed.id, {
          ...closeInput,
          resolution: 'open',
        })
        .pipe(Effect.flip)
      return {
        closed,
        conflictingReplay,
        opened,
        replayed,
        suspectedClosed,
        suspectedOpen,
      }
    })
  )

  assert.equal(result.suspectedOpen.listingAvailability, 'suspected_closed')
  assert.equal(result.suspectedClosed.listingAvailability, 'suspected_closed')
  assert.equal(result.opened.application.listingAvailability, 'open')
  assert.equal(result.opened.application.listingClosedCandidateAt, null)
  assert.equal(result.opened.application.listingConsecutiveClosedChecks, 0)
  assert.equal(result.opened.check.provider, 'manual-review')
  assert.equal(result.opened.check.confidence, 'confirmed')
  assert.equal(result.closed.application.listingAvailability, 'closed')
  assert.equal(result.closed.application.applicationStatus, 'archived')
  assert.equal(result.closed.archived, true)
  assert.equal(result.replayed.replayed, true)
  assert.equal(result.replayed.check.id, result.closed.check.id)
  assert.equal(result.conflictingReplay._tag, 'RegistryConflictError')
})

test('keeps completed run counts accurate when durable batches arrive out of order', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const applications = yield* ApplicationsService
      const listingChecks = yield* ListingChecksService
      const firstApplication = yield* applications.upsert(
        makeApplicationInput('out-of-order-first')
      )
      const secondApplication = yield* applications.upsert(
        makeApplicationInput('out-of-order-second')
      )
      const finding = (
        application: typeof firstApplication,
        operationId: string
      ) => ({
        applicationId: application.id,
        canonicalUrl: application.canonicalUrl,
        observation: {
          checkedAt: recordedAt,
          checkerVersion: 'test-local',
          confidence: 'high' as const,
          contentHash: null,
          evidence: [
            {
              code: 'application_action',
              detail: 'The application action is available.',
              sourceUrl: application.canonicalUrl,
            },
          ],
          finalUrl: application.canonicalUrl,
          httpStatus: 200,
          outcome: 'open' as const,
          provider: 'test-provider',
          reasonCode: 'working_application_path' as const,
          requestedUrl: application.canonicalUrl,
        },
        operationId,
        target: {
          company: application.company,
          role: application.role,
          url: application.canonicalUrl,
        },
      })
      const common = {
        expectedCount: 3,
        mode: 'report' as const,
        runId: 'out-of-order-run',
        startedAt: recordedAt,
      }
      const final = yield* listingChecks.submitFindings({
        ...common,
        finalBatch: true,
        findings: [finding(secondApplication, 'out-of-order:second')],
      })
      yield* Effect.sleep(Duration.millis(5))
      const replayedFinal = yield* listingChecks.submitFindings({
        ...common,
        finalBatch: true,
        findings: [finding(secondApplication, 'out-of-order:second')],
      })
      const earlier = yield* listingChecks.submitFindings({
        ...common,
        finalBatch: false,
        findings: [finding(firstApplication, 'out-of-order:first')],
      })
      return { earlier, final, replayedFinal }
    })
  )

  assert.equal(result.final.run.state, 'completed')
  assert.equal(result.final.run.checkedCount, 1)
  assert.equal(result.final.run.errorCount, 2)
  assert.equal(result.replayedFinal.replayedCount, 1)
  assert.equal(
    result.replayedFinal.run.completedAt,
    result.final.run.completedAt
  )
  assert.equal(result.earlier.run.state, 'completed')
  assert.equal(result.earlier.run.checkedCount, 2)
  assert.equal(result.earlier.run.errorCount, 1)
})

test('replays note and capture commands and rejects operation conflicts', async () => {
  const result = await runtime.runPromise(noteAndCaptureWorkflow)

  assert.equal(result.noteReplayed, false)
  assert.equal(result.replayedNote, true)
  assert.equal(result.noteIdsMatch, true)
  assert.equal(result.noteConflictTag, 'RegistryConflictError')
  assert.equal(result.captureReplayed, false)
  assert.equal(result.replayedCapture, true)
  assert.equal(result.captureIdsMatch, true)
  assert.equal(result.storedNoteCount, 1)
  assert.equal(result.storedCaptureCount, 1)

  const receipts = await harness.query<{ count: number }>(
    `select count(*) as count
       from command_receipts
      where operation_id in (?1, ?2)`,
    ['service:note:1', 'service:capture:1']
  )
  assert.deepEqual(receipts, [{ count: 2 }])
})

test('converts stored compensation through an injected FX service', async () => {
  const result = await runtime.runPromise(compensationWorkflow)

  assert.equal(result.originalCurrency, 'EUR')
  assert.deepEqual(result.conversion, {
    currencyCode: 'USD',
    maximumMinor: 24_000_000,
    minimumMinor: 20_000_000,
    observedAt: '2026-07-12T12:00:00.000Z',
    provider: 'service-integration',
    rate: 2,
  })
})

test('resolves concurrent identical note operations to one write and one replay', async () => {
  const result = await runtime.runPromise(concurrentNoteWorkflow)

  assert.deepEqual([...result.replayed].sort(), [false, true])
  assert.equal(result.noteIds[0], result.noteIds[1])
  assert.equal(result.storedNoteCount, 1)
  assert.equal(result.storedNoteEventCount, 1)

  const receipts = await harness.query<{ count: number }>(
    `select count(*) as count
       from command_receipts
      where operation_id = ?1`,
    ['service:concurrent-note']
  )
  assert.deepEqual(receipts, [{ count: 1 }])
})

test('converges concurrent captures on one job and replays each operation', async () => {
  const result = await runtime.runPromise(concurrentCapturesWorkflow)

  assert.equal(result.firstReplayed, false)
  assert.equal(result.secondReplayed, false)
  assert.equal(result.applicationIds[0], result.applicationIds[1])
  assert.notEqual(result.captureIds[0], result.captureIds[1])
  assert.equal(result.replayed, true)
  assert.equal(result.replayCaptureId, result.captureIds[0])
  assert.equal(result.storedCaptureCount, 2)

  const applications = await harness.query<{ count: number }>(
    'select count(*) as count from applications where job_key = ?1',
    ['service:concurrent-capture']
  )
  const receipts = await harness.query<{ operationId: string }>(
    `select operation_id as operationId
       from command_receipts
      where operation_id like 'service:capture-race:%'
      order by operation_id`
  )
  assert.deepEqual(applications, [{ count: 1 }])
  assert.deepEqual(receipts, [
    { operationId: 'service:capture-race:a' },
    { operationId: 'service:capture-race:b' },
  ])
})

test('keeps child replacements consistent with the concurrent job-key winner', async () => {
  const results = await runtime.runPromise(concurrentUpsertsWorkflow)

  assert.equal(results.length, 6)
  for (const result of results) {
    assert.equal(result.childStateMatchesWinner, true)
    assert.deepEqual(result.responseApplicationIds, [
      result.storedApplicationId,
      result.storedApplicationId,
    ])
  }

  const applications = await harness.query<{ count: number }>(
    `select count(*) as count
       from applications
      where job_key like 'service:concurrent-upsert-%'`
  )
  assert.deepEqual(applications, [{ count: 6 }])
})

test('merges non-destructive captures while explicit upserts still replace fields', async () => {
  const result = await runtime.runPromise(captureMergeWorkflow)

  assert.equal(result.captured.id, result.existingId)
  assert.equal(result.captured.location, 'Existing enriched location')
  assert.equal(result.captured.sourceJobId, 'existing-source-job-id')
  assert.equal(result.captured.targetStage, 'verify_first')
  assert.equal(result.promoted.id, result.backlogId)
  assert.equal(result.promoted.targetStage, 'apply_next')
  assert.deepEqual(result.explicitlyReplaced, {
    location: null,
    sourceJobId: null,
    targetStage: 'secondary',
  })
})

test('uses database defaults for applications and capture-created applications', async () => {
  const result = await runtime.runPromise(defaultsWorkflow)

  assert.deepEqual(result.created, {
    applicationStatus: 'not_started',
    followUpAt: null,
    personalPriority: null,
    targetStage: 'backlog',
    version: 1,
  })
  assert.equal(result.captureStatus, 'preparing')
})

test('preserves omitted patch fields and clears explicit nulls', async () => {
  const result = await runtime.runPromise(patchNullabilityWorkflow)

  assert.equal(result.partiallyUpdated.followUpAt, '2026-07-20T12:00:00.000Z')
  assert.equal(
    result.partiallyUpdated.lastContactAt,
    '2026-07-19T12:00:00.000Z'
  )
  assert.equal(result.partiallyUpdated.location, 'Remote')
  assert.equal(result.partiallyUpdated.personalPriority, 'high')
  assert.deepEqual(result.cleared, {
    followUpAt: null,
    lastContactAt: '2026-07-19T12:00:00.000Z',
    location: null,
    personalPriority: null,
  })
})

test('allows exactly one winner in a concurrent optimistic-version race', async () => {
  const result = await runtime.runPromise(optimisticPatchRaceWorkflow)

  assert.equal(result.successCount, 1)
  assert.deepEqual(result.failureTags, ['RegistryConflictError'])
  assert.equal(result.currentVersion, result.initialVersion + 1)
  assert.ok(
    result.currentStatus === 'applied' || result.currentStatus === 'rejected'
  )
})

test('commits one explicit lifecycle transition and replays its winner', async () => {
  const result = await runtime.runPromise(lifecycleRaceWorkflow)

  assert.equal(result.successCount, 1)
  assert.deepEqual(result.failureTags, ['RegistryConflictError'])
  assert.equal(result.currentVersion, result.initialVersion + 1)
  assert.ok(
    result.currentStatus === 'applied' || result.currentStatus === 'rejected'
  )
  assert.equal(result.replayed, true)
  assert.deepEqual(result.storedOperationIds, [result.winningOperationId])
})

test('rolls back every write when an atomic operation receipt cannot commit', async () => {
  const result = await runtime.runPromise(rollbackWorkflow(harness.database))

  assert.equal(result.failureTag, 'RegistryDatabaseError')
  assert.equal(result.noteCount, 0)
  assert.equal(result.receiptCount, 0)
  assert.equal(result.eventCount, 0)
  assert.equal(result.afterRevision, result.beforeRevision)
})
