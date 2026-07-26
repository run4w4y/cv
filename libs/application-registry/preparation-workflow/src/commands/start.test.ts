import { describe, expect, test } from 'bun:test'
import { Crypto, Effect, Exit, Layer, Schema } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { type PreparationJobInput, PreparationWorkflowError } from '../domain'
import { PreparationProgress, preparationProgressLayer } from '../progress'
import { cvGenerationGuidanceTestFixture } from '../test-support'
import { retryAiWorkflowJob } from './start'

const input: PreparationJobInput = {
  artifacts: {
    coverLetter: null,
    cv: { generationGuidance: cvGenerationGuidanceTestFixture },
  },
  jobId: 'job-1',
  locale: 'en',
  target: {
    _tag: 'PostingUrl',
    url: 'https://jobs.example.test/platform',
  },
}

const testLayer = Layer.mergeAll(
  preparationProgressLayer,
  WorkflowEngine.layerMemory,
  Layer.succeed(
    Crypto.Crypto,
    Crypto.make({
      digest: (_algorithm, bytes) => Effect.succeed(bytes),
      randomBytes: (size) => new Uint8Array(size),
    })
  )
)

describe('job-oriented workflow commands', () => {
  test('rejects retry for a missing job with a typed input error', async () => {
    const result = await Effect.runPromiseExit(
      retryAiWorkflowJob('missing').pipe(Effect.provide(testLayer))
    )
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(
        Exit.findErrorOption(result).pipe((error) =>
          error._tag === 'Some'
            ? Schema.is(PreparationWorkflowError)(error.value)
            : false
        )
      ).toBe(true)
    }
  })

  test('does not retry an open authoritative job', async () => {
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.reserve([
          {
            batchId: 'batch-1',
            batchPosition: 0,
            input,
            retryOfJobId: null,
          },
        ])
        return yield* retryAiWorkflowJob('job-1')
      }).pipe(Effect.provide(testLayer))
    )
    expect(Exit.isFailure(result)).toBe(true)
  })
})
