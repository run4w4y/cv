import { describe, expect, test } from 'bun:test'
import {
  makePdfQueueConfiguration,
  PdfQueue,
  PdfQueueError,
} from '@cv/application-registry-pdf-queue'
import { PdfDispatchesService } from '@cv/application-registry-service'
import { Effect, Layer, Option } from 'effect'

import { dispatchPendingPdfJobs } from './dispatcher'

const pending = (artifactId: string) => ({
  applicationId: 'application-1',
  artifactId,
  attempts: 0,
  contentEntryId: 'entry-1',
  createdAt: '2026-07-21T00:00:00.000Z',
  dispatchedAt: null,
  lastAttemptAt: null,
  lastError: null,
  messageVersion: 1,
  updatedAt: '2026-07-21T00:00:00.000Z',
})

describe('PDF outbox dispatcher', () => {
  test('records each publish result and continues the batch', async () => {
    const failed: string[] = []
    const published: string[] = []
    const layers = Layer.merge(
      Layer.succeed(
        PdfDispatchesService,
        PdfDispatchesService.of({
          markFailed: (artifactId) =>
            Effect.sync(() => {
              failed.push(artifactId)
            }),
          markPublished: (artifactId) =>
            Effect.sync(() => {
              published.push(artifactId)
            }),
          pending: () => Effect.succeed([pending('ok'), pending('failure')]),
        })
      ),
      Layer.succeed(
        PdfQueue,
        PdfQueue.of({
          configuration: makePdfQueueConfiguration({
            nats: {
              clientName: 'test',
              maxReconnectAttempts: 0,
              password: 'test',
              server: 'nats://test',
              username: 'test',
            },
          }),
          publish: (request) =>
            request.artifactId === 'failure'
              ? Effect.fail(
                  new PdfQueueError({
                    cause: new Error('unavailable'),
                    message: 'NATS unavailable',
                    operation: 'publish',
                  })
                )
              : Effect.void,
          take: Effect.succeed(Option.none()),
        })
      )
    )

    const summary = await Effect.runPromise(
      dispatchPendingPdfJobs(25).pipe(Effect.provide(layers))
    )

    expect(summary).toEqual({ attempted: 2, failed: 1, published: 1 })
    expect(published).toEqual(['ok'])
    expect(failed).toEqual(['failure'])
  })
})
