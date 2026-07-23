import { Context, Effect, Layer, Schema } from 'effect'

import type { RegistryEvent } from './model'

export class RegistryEventPublishError extends Schema.TaggedErrorClass<RegistryEventPublishError>()(
  'RegistryEventPublishError',
  {
    cause: Schema.Defect(),
    eventId: Schema.String,
    message: Schema.String,
  }
) {}

export interface RegistryEventPublisherShape {
  readonly publish: (
    event: RegistryEvent
  ) => Effect.Effect<void, RegistryEventPublishError>
}

export class RegistryEventPublisher extends Context.Service<
  RegistryEventPublisher,
  RegistryEventPublisherShape
>()('@cv/application-registry-events/RegistryEventPublisher') {}

export const publishRegistryEventBestEffort = Effect.fn(
  'RegistryEventPublisher.publishBestEffort'
)((publisher: RegistryEventPublisherShape, event: RegistryEvent) =>
  publisher.publish(event).pipe(
    Effect.catch((error) =>
      Effect.logWarning('RegistryEvents.publish_failed', {
        eventId: event.eventId,
        eventType: event._tag,
        message: error.message,
      })
    )
  )
)

export const RegistryEventPublisherNoop = Layer.succeed(
  RegistryEventPublisher,
  RegistryEventPublisher.of({
    publish: Effect.fn('RegistryEventPublisher.noop')(() => Effect.void),
  })
)
