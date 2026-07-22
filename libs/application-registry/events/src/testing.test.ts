import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { RegistryEventSchema } from './model'
import { RegistryEventPublisher } from './publisher'
import {
  RegistryEventPublisherRecording,
  RegistryEventRecorder,
} from './testing'

const event = RegistryEventSchema.cases.ApplicationCreated.make({
  applicationId: 'application-1',
  correlationId: 'create-1',
  eventId: 'application-created:application-1',
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
          eventId: 'application-created:application-2',
          applicationId: 'application-2',
        })
        return yield* recorder.events()
      }).pipe(Effect.provide(RegistryEventPublisherRecording))
    )

    expect(recorded.map(({ eventId }) => eventId)).toEqual([
      'application-created:application-1',
      'application-created:application-2',
    ])
  })
})
