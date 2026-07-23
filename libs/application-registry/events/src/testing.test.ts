import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { RegistryEventSchema } from './model'
import {
  publishRegistryEventBestEffort,
  RegistryEventPublishError,
  RegistryEventPublisher,
} from './publisher'
import {
  RegistryEventPublisherRecording,
  RegistryEventRecorder,
} from './testing'

const event = RegistryEventSchema.cases.CvPublicationChanged.make({
  applicationId: 'application-1',
  correlationId: 'create-1',
  eventId: 'cv-publication-changed:application-1',
  occurredAt: '2026-07-21T12:00:00.000Z',
  version: 1,
})

describe('RegistryEventPublisherRecording', () => {
  test('records transport-neutral domain events in publication order', async () => {
    const recorded = await Effect.runPromise(
      Effect.gen(function* () {
        const publisher = yield* RegistryEventPublisher
        const recorder = yield* RegistryEventRecorder
        yield* publisher.publish(event)
        yield* publisher.publish({
          ...event,
          eventId: 'cv-publication-changed:application-2',
          applicationId: 'application-2',
        })
        return yield* recorder.events()
      }).pipe(Effect.provide(RegistryEventPublisherRecording))
    )

    expect(recorded.map(({ eventId }) => eventId)).toEqual([
      'cv-publication-changed:application-1',
      'cv-publication-changed:application-2',
    ])
  })

  test('keeps notification delivery best-effort', async () => {
    let attemptedEventId: string | undefined
    const failingPublisher = RegistryEventPublisher.of({
      publish: Effect.fn('RegistryEventPublisher.failingTest')((event) => {
        attemptedEventId = event.eventId
        return Effect.fail(
          new RegistryEventPublishError({
            cause: new Error('transport unavailable'),
            eventId: event.eventId,
            message: 'Transport unavailable.',
          })
        )
      }),
    })

    await Effect.runPromise(
      publishRegistryEventBestEffort(failingPublisher, event)
    )

    expect(attemptedEventId).toBe(event.eventId)
  })
})
