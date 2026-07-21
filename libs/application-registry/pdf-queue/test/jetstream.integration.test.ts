import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import {
  type StartedNatsTestContainer,
  startNatsTestContainer,
} from '@cv/test-infrastructure/nats'
import { Effect, Option } from 'effect'

import { makePdfQueueConfiguration, makePdfQueueLayer, PdfQueue } from '../src'

let nats: StartedNatsTestContainer

before(
  async () => {
    nats = await startNatsTestContainer()
  },
  { timeout: 60_000 }
)

after(
  async () => {
    await nats?.dispose()
  },
  { timeout: 30_000 }
)

describe('PDF JetStream transport', () => {
  test('provisions resources and deduplicates an outbox retry', {
    timeout: 30_000,
  }, async () => {
    const suffix = String(Date.now())
    const layer = makePdfQueueLayer(
      makePdfQueueConfiguration({
        consumerName: `cv-pdf-test-${suffix}`,
        nats: {
          clientName: `cv-pdf-test-${suffix}`,
          maxReconnectAttempts: 0,
          password: nats.password,
          server: nats.server,
          username: nats.username,
        },
        pullExpiresMilliseconds: 1_000,
        streamName: `CV_PDF_TEST_${suffix}`,
        subject: `cv.pdf.test.${suffix}`,
      })
    )
    const request = {
      _tag: 'PdfGenerationRequested' as const,
      applicationId: 'application-1',
      artifactId: 'artifact-1',
      entryId: 'entry-1',
      version: 1 as const,
    }

    await Effect.runPromise(PdfQueue.pipe(Effect.asVoid, Effect.provide(layer)))

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const queue = yield* PdfQueue
        yield* queue.publish(request)
        yield* queue.publish(request)
        const first = yield* queue.take
        const message = Option.getOrThrow(first)
        yield* message.ack
        const second = yield* queue.take
        return {
          deliveryCount: message.deliveryCount,
          hasSecondMessage: Option.isSome(second),
        }
      }).pipe(Effect.provide(layer))
    )

    assert.deepEqual(result, { deliveryCount: 1, hasSecondMessage: false })
  })
})
