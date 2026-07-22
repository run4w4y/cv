import { describe, expect, test } from 'bun:test'
import { Crypto, Effect, Exit, Layer, SubscriptionRef } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  ApplicationPreparation,
  applicationPreparationLayer,
} from './application-preparation'
import { PreparationWorkflowError, ReviewDecisionSchema } from './domain'
import { makeStructuredGenerationTestLayer } from './test-support/generation'
import { makePreparationStoreTestLayer } from './test-support/store'

const testCryptoLayer = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (_algorithm, bytes) => Effect.succeed(bytes),
    randomBytes: (size) => new Uint8Array(size),
  })
)

const testLayer = applicationPreparationLayer().pipe(
  Layer.provide(
    Layer.mergeAll(
      makePreparationStoreTestLayer(),
      makeStructuredGenerationTestLayer().layer,
      testCryptoLayer,
      WorkflowEngine.layerMemory
    )
  )
)

describe('ApplicationPreparation', () => {
  test('hides engine handles and owns review and cancellation lookup', async () => {
    const observed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const preparation = yield* ApplicationPreparation
          yield* preparation.cancel('missing-run')
          const review = yield* Effect.exit(
            preparation.submitReview({
              decision: ReviewDecisionSchema.cases.Rejected.make({
                reason: 'Not suitable.',
              }),
              runId: 'missing-run',
            })
          )
          return {
            review,
            runs: yield* SubscriptionRef.get(preparation.runs),
          }
        })
      ).pipe(Effect.provide(testLayer))
    )

    expect(observed.runs.size).toBe(0)
    expect(Exit.isFailure(observed.review)).toBe(true)
    if (Exit.isFailure(observed.review)) {
      expect(Exit.findErrorOption(observed.review)).toMatchObject({
        value: expect.any(PreparationWorkflowError),
      })
    }
  })
})
