import { describe, expect, test } from 'bun:test'
import { Crypto, Effect, Exit, Layer, SubscriptionRef } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  ApplicationPreparation,
  applicationPreparationLayer,
} from './application-preparation'
import { PreparationWorkflowError } from './domain'
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
  test('hides engine handles and owns job review and cancellation lookup', async () => {
    const observed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const preparation = yield* ApplicationPreparation
          yield* preparation.cancelJob('missing-job')
          const approval = yield* Effect.exit(
            preparation.approveArtifact({
              artifact: 'cv',
              jobId: 'missing-job',
              revisionId: 'missing-revision',
            })
          )
          return {
            approval,
            jobs: yield* SubscriptionRef.get(preparation.jobs),
          }
        })
      ).pipe(Effect.provide(testLayer))
    )

    expect(observed.jobs.size).toBe(0)
    expect(Exit.isFailure(observed.approval)).toBe(true)
    if (Exit.isFailure(observed.approval)) {
      expect(Exit.findErrorOption(observed.approval)).toMatchObject({
        value: expect.any(PreparationWorkflowError),
      })
    }
  })
})
