import { describe, expect, test } from 'bun:test'
import { Effect, Exit, SubscriptionRef } from 'effect'
import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'

import type { PreparationWorkflowInput, SavedCandidate } from './domain'
import { PreparationProgress, preparationProgressLayer } from './progress'

const input: PreparationWorkflowInput = {
  coverLetterPrompt: null,
  kind: 'cv',
  locale: 'en',
  modelId: 'model-1',
  runId: 'run-1',
  source: {
    _tag: 'ReviewedContext',
    applicationId: 'application-1',
    factsReleaseId: 'facts-release-1',
    jobSnapshotId: 'snapshot-1',
    url: 'https://jobs.example.test/role',
  },
}

const candidate = {
  application: { id: 'application-1' },
  candidate: { document: {}, metadata: [] },
  result: { entry: { id: 'entry-1' }, revision: { id: 'revision-1' } },
} as unknown as SavedCandidate

const token = 'review-token' as DurableDeferred.Token

describe('preparation progress state machine', () => {
  test('rejects a conflicting batch without reserving its non-conflicting runs', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(input)

        const first = {
          ...input,
          runId: 'run-2',
          source: {
            ...input.source,
            applicationId: 'application-2',
            url: 'https://jobs.example.test/other-role',
          },
        }
        const conflict = { ...input, runId: 'run-3' }
        const exit = yield* Effect.exit(progress.reserve([first, conflict]))
        const runs = yield* SubscriptionRef.get(progress.runs)
        return { exit, runs }
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(Exit.isFailure(result.exit)).toBe(true)
    expect([...result.runs.keys()]).toEqual([input.runId])
  })

  test('rejects duplicate run ids before inserting either identity', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        const first = { ...input, runId: 'duplicate-run' }
        const second = {
          ...input,
          runId: first.runId,
          source: {
            ...input.source,
            applicationId: 'application-2',
            url: 'https://jobs.example.test/other-role',
          },
        }
        const exit = yield* Effect.exit(progress.reserve([first, second]))
        return {
          exit,
          runs: yield* SubscriptionRef.get(progress.runs),
        }
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(Exit.isFailure(result.exit)).toBe(true)
    expect(result.runs.size).toBe(0)
  })

  test('reserves explicit applications independently and rejects mixed URL identities atomically', async () => {
    const runs = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        const first = {
          ...input,
          runId: 'run-2',
          source: { ...input.source, applicationId: 'application-2' },
        }
        const second = {
          ...input,
          runId: 'run-3',
          source: { ...input.source, applicationId: 'application-3' },
        }
        yield* progress.reserve([first, second])

        const anonymous = {
          ...input,
          runId: 'run-4',
          source: {
            _tag: 'CaptureUrl' as const,
            url: 'https://jobs.example.test/new-role',
          },
        }
        const explicit = {
          ...input,
          runId: 'run-5',
          source: {
            ...input.source,
            applicationId: 'application-4',
            url: anonymous.source.url,
          },
        }
        const exit = yield* Effect.exit(progress.reserve([anonymous, explicit]))
        expect(Exit.isFailure(exit)).toBe(true)
        return yield* SubscriptionRef.get(progress.runs)
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect([...runs.keys()]).toEqual(['run-2', 'run-3'])
    expect(runs.get('run-2')?.executionId).toBeNull()
    expect(runs.get('run-3')?.executionId).toBeNull()
  })

  test('releases only still-open startup reservations', async () => {
    const runs = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        const failed = { ...input, runId: 'run-failed' }
        const queued = {
          ...input,
          runId: 'run-queued',
          source: {
            ...input.source,
            applicationId: 'application-2',
            url: 'https://jobs.example.test/other-role',
          },
        }
        yield* progress.reserve([failed, queued])
        yield* progress.fail(failed.runId, 'startup failed')
        yield* progress.releaseReservations([failed.runId, queued.runId])
        return yield* SubscriptionRef.get(progress.runs)
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(runs.get('run-failed')?.status).toBe('failed')
    expect(runs.has('run-queued')).toBe(false)
  })

  test('does not regress review or terminal states during workflow replay', async () => {
    const run = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(input)
        yield* progress.setExecution(input.runId, 'execution-1')
        yield* progress.stage(input.runId, 'analysis', 'Analyzing')
        yield* progress.reviewReady(
          input.runId,
          'application-1',
          candidate,
          token
        )
        expect(yield* progress.reviewSubmitted(input.runId, token)).toBe(true)

        yield* progress.stage(input.runId, 'capture', 'Replayed capture')
        yield* progress.reviewReady(
          input.runId,
          'application-1',
          candidate,
          token
        )
        const submitted = (yield* SubscriptionRef.get(progress.runs)).get(
          input.runId
        )
        expect(submitted?.status).toBe('review_submitted')
        expect(submitted?.reviewToken).toBeNull()

        yield* progress.complete(input.runId, {
          message: 'Approved',
          result: candidate.result,
          status: 'approved',
        })
        yield* progress.stage(input.runId, 'saving', 'Replayed save')
        yield* progress.reviewReady(
          input.runId,
          'application-1',
          candidate,
          token
        )
        yield* progress.fail(input.runId, 'late failure')
        yield* progress.cancel(input.runId)
        return (yield* SubscriptionRef.get(progress.runs)).get(input.runId)
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(run?.status).toBe('approved')
    expect(run?.stage).toBe('complete')
    expect(run?.message).toBe('Approved')
  })

  test('claims cancellation only for the matching open execution', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(input)
        yield* progress.setExecution(input.runId, 'execution-1')

        const wrong = yield* progress.requestCancel(input.runId, 'wrong')
        const claimed = yield* progress.requestCancel(
          input.runId,
          'execution-1'
        )
        const repeated = yield* progress.requestCancel(
          input.runId,
          'execution-1'
        )
        yield* progress.stage(input.runId, 'analysis', 'Too late')
        yield* progress.fail(input.runId, 'Too late')
        const run = (yield* SubscriptionRef.get(progress.runs)).get(input.runId)
        return { claimed, repeated, run, wrong }
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(result.wrong).toBeNull()
    expect(result.claimed?.mode).toBe('active')
    expect(result.repeated).toBeNull()
    expect(result.run?.status).toBe('cancelled')
  })

  test('does not cancel a reservation before its execution is activated', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(input)

        const claimed = yield* progress.requestCancel(
          input.runId,
          'precomputed-execution-id'
        )
        const run = (yield* SubscriptionRef.get(progress.runs)).get(input.runId)
        return { claimed, run }
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(result.claimed).toBeNull()
    expect(result.run?.executionId).toBeNull()
    expect(result.run?.status).toBe('queued')
  })

  test('restores the exact active state when engine cancellation fails', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(input)
        yield* progress.setExecution(input.runId, 'execution-1')
        yield* progress.stage(input.runId, 'analysis', 'Analyzing')
        const claim = yield* progress.requestCancel(input.runId, 'execution-1')
        if (claim === null)
          return yield* Effect.die('Expected cancellation claim.')
        const cancelling = (yield* SubscriptionRef.get(progress.runs)).get(
          input.runId
        )
        yield* progress.restoreCancellation(input.runId, 'execution-1', claim)
        return {
          claim,
          cancelling,
          restored: (yield* SubscriptionRef.get(progress.runs)).get(
            input.runId
          ),
        }
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(result.claim.mode).toBe('active')
    expect(result.cancelling?.status).toBe('cancelling')
    expect(result.restored?.status).toBe('running')
    expect(result.restored?.stage).toBe('analysis')
    expect(result.restored?.message).toBe('Analyzing')
  })

  test('classifies review suspension separately and preserves its review token', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(input)
        yield* progress.setExecution(input.runId, 'execution-1')
        yield* progress.stage(input.runId, 'saving', 'Saving')
        yield* progress.reviewReady(
          input.runId,
          'application-1',
          candidate,
          token
        )
        const claim = yield* progress.requestCancel(input.runId, 'execution-1')
        if (claim === null)
          return yield* Effect.die('Expected cancellation claim.')
        const cancelling = (yield* SubscriptionRef.get(progress.runs)).get(
          input.runId
        )
        yield* progress.restoreCancellation(input.runId, 'execution-1', claim)
        return {
          claim,
          cancelling,
          restored: (yield* SubscriptionRef.get(progress.runs)).get(
            input.runId
          ),
        }
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(result.claim.mode).toBe('suspended')
    expect(result.cancelling?.reviewToken).toBe(token)
    expect(result.restored?.status).toBe('awaiting_review')
    expect(result.restored?.reviewToken).toBe(token)
  })
})
