import { describe, expect, test } from 'bun:test'
import { Effect, SubscriptionRef } from 'effect'

import { type PreparationJobInput, projectPreparationJob } from '../domain'
import { preparationActivityProjection } from '../selectors'
import { cvGenerationGuidanceTestFixture } from '../test-support'
import { PreparationProgress } from './model'
import { preparationProgressLayer } from './service'

const pairedInput: PreparationJobInput = {
  artifacts: {
    coverLetter: { prompt: 'Write a concise letter.' },
    cv: { generationGuidance: cvGenerationGuidanceTestFixture },
  },
  jobId: 'job-1',
  locale: 'en',
  target: {
    _tag: 'PostingUrl',
    url: 'https://jobs.example.test/platform',
  },
}

const withProgress = <A, E>(effect: Effect.Effect<A, E, PreparationProgress>) =>
  Effect.runPromise(effect.pipe(Effect.provide(preparationProgressLayer)))

describe('PreparationProgress job aggregate', () => {
  test('reserves one authoritative job with empty artifact branches', async () => {
    const job = await withProgress(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.reserve([
          {
            batchId: 'batch-1',
            batchPosition: 0,
            input: pairedInput,
            retryOfJobId: null,
          },
        ])
        return (yield* SubscriptionRef.get(progress.jobs)).get('job-1')
      })
    )

    expect(job).toMatchObject({
      jobId: 'job-1',
      shared: { stage: 'queued', status: 'running' },
      status: 'queued',
    })
    expect(job?.shared.history).toHaveLength(1)
    expect(job?.artifacts.cv?.history).toEqual([])
    expect(job?.artifacts.coverLetter?.history).toEqual([])
  })

  test('records shared nodes once before independent artifact histories', async () => {
    const job = await withProgress(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.reserve([
          {
            batchId: 'batch-1',
            batchPosition: 0,
            input: pairedInput,
            retryOfJobId: null,
          },
        ])
        yield* progress.setExecution('job-1', 'execution-1')
        yield* progress.stageShared('job-1', 'application', 'Application.')
        yield* progress.stageShared('job-1', 'capture', 'Capture.')
        yield* progress.stageShared('job-1', 'analysis', 'Analysis.')
        yield* progress.stageShared('job-1', 'evidence', 'Evidence.')
        yield* progress.stageArtifact('job-1', 'cv', 'planning', 'CV plan.')
        yield* progress.stageArtifact(
          'job-1',
          'cover_letter',
          'composition',
          'Letter composition.'
        )
        return (yield* SubscriptionRef.get(progress.jobs)).get('job-1')
      })
    )

    expect(job?.shared.status).toBe('completed')
    expect(
      job?.shared.history.filter(({ stage }) => stage === 'analysis')
    ).toHaveLength(2)
    if (job === undefined) throw new Error('Expected job.')
    const activity = preparationActivityProjection(projectPreparationJob(job))
    expect(
      activity.events.filter(
        ({ scope, stage, status }) =>
          scope === 'shared' && stage === 'analysis' && status === 'running'
      )
    ).toHaveLength(1)
  })

  test('fails one artifact without rewriting completed shared work', async () => {
    const job = await withProgress(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.reserve([
          {
            batchId: 'batch-1',
            batchPosition: 0,
            input: pairedInput,
            retryOfJobId: null,
          },
        ])
        yield* progress.setExecution('job-1', 'execution-1')
        yield* progress.stageShared('job-1', 'evidence', 'Evidence.')
        yield* progress.stageArtifact('job-1', 'cv', 'planning', 'CV plan.')
        yield* progress.failArtifact('job-1', 'cv', 'CV failed.')
        return (yield* SubscriptionRef.get(progress.jobs)).get('job-1')
      })
    )

    expect(job?.shared.status).toBe('completed')
    expect(job?.artifacts.cv).toMatchObject({
      error: 'CV failed.',
      status: 'failed',
    })
    expect(job?.artifacts.coverLetter?.status).toBe('queued')
  })

  test('records a dependency-blocked artifact without inventing a failure', async () => {
    const job = await withProgress(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.reserve([
          {
            batchId: 'batch-1',
            batchPosition: 0,
            input: pairedInput,
            retryOfJobId: null,
          },
        ])
        yield* progress.setExecution('job-1', 'execution-1')
        yield* progress.blockArtifact(
          'job-1',
          'cover_letter',
          'Waiting document was blocked by its CV dependency.'
        )
        return (yield* SubscriptionRef.get(progress.jobs)).get('job-1')
      })
    )

    expect(job?.artifacts.coverLetter).toMatchObject({
      error: null,
      message: 'Waiting document was blocked by its CV dependency.',
      stage: 'composition',
      status: 'blocked',
    })
    expect(job?.artifacts.coverLetter?.history.at(-1)).toMatchObject({
      stage: 'composition',
      status: 'blocked',
    })
    expect(job?.status).toBe('queued')
  })

  test('claims and restores cancellation atomically at the job level', async () => {
    const observed = await withProgress(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.reserve([
          {
            batchId: 'batch-1',
            batchPosition: 0,
            input: pairedInput,
            retryOfJobId: null,
          },
        ])
        yield* progress.setExecution('job-1', 'execution-1')
        const claim = yield* progress.requestCancel('job-1', 'execution-1')
        const cancelling = (yield* SubscriptionRef.get(progress.jobs)).get(
          'job-1'
        )
        if (claim !== null) {
          yield* progress.restoreCancellation('job-1', 'execution-1', claim)
        }
        const restored = (yield* SubscriptionRef.get(progress.jobs)).get(
          'job-1'
        )
        return { cancelling, restored }
      })
    )

    expect(observed.cancelling?.status).toBe('cancelling')
    expect(observed.restored?.status).toBe('queued')
  })
})
